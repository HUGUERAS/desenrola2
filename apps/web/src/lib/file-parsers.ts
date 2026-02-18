/**
 * file-parsers.ts — Parsers para KML, DXF e GeoJSON → WKT
 */

/**
 * Parse KML → WKT POLYGON
 */
export function parseKML(content: string): string | null {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');

        // Procura <coordinates> dentro de <Polygon>
        const polygons = doc.querySelectorAll('Polygon coordinates');
        if (polygons.length === 0) {
            // Tenta encontrar qualquer <coordinates>
            const coords = doc.querySelector('coordinates');
            if (!coords?.textContent) return null;
            return kmlCoordsToWkt(coords.textContent);
        }

        return kmlCoordsToWkt(polygons[0].textContent || '');
    } catch (error) {
        console.error('Erro ao parsear KML:', error);
        return null;
    }
}

function kmlCoordsToWkt(coordsText: string): string | null {
    const lines = coordsText.trim().split(/\s+/);
    const pairs = lines
        .map((line) => {
            const parts = line.split(',');
            if (parts.length < 2) return null;
            return [parseFloat(parts[0]), parseFloat(parts[1])];
        })
        .filter((p): p is number[] => p !== null && !isNaN(p[0]) && !isNaN(p[1]));

    if (pairs.length < 3) return null;

    // Fecha o polígono se necessário
    const first = pairs[0];
    const last = pairs[pairs.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        pairs.push([...first]);
    }

    const wktCoords = pairs.map(([lon, lat]) => `${lon} ${lat}`).join(', ');
    return `SRID=4674;POLYGON((${wktCoords}))`;
}

/**
 * Parse GeoJSON → WKT POLYGON
 */
export function parseGeoJSON(content: string): string | null {
    try {
        const json = JSON.parse(content);

        let coordinates: number[][] | null = null;

        if (json.type === 'Polygon') {
            coordinates = json.coordinates[0];
        } else if (json.type === 'Feature' && json.geometry?.type === 'Polygon') {
            coordinates = json.geometry.coordinates[0];
        } else if (json.type === 'FeatureCollection') {
            const feature = json.features?.find(
                (f: any) => f.geometry?.type === 'Polygon'
            );
            if (feature) coordinates = feature.geometry.coordinates[0];
        }

        if (!coordinates || coordinates.length < 3) return null;

        const wktCoords = coordinates
            .map(([lon, lat]: number[]) => `${lon} ${lat}`)
            .join(', ');
        return `SRID=4674;POLYGON((${wktCoords}))`;
    } catch (error) {
        console.error('Erro ao parsear GeoJSON:', error);
        return null;
    }
}

/**
 * Parse DXF simplificado → WKT POLYGON
 * Extrai entidades LWPOLYLINE
 */
export function parseDXF(content: string): string | null {
    try {
        const lines = content.split('\n').map((l) => l.trim());
        const coords: number[][] = [];

        let i = 0;
        let inLwPolyline = false;

        while (i < lines.length) {
            if (lines[i] === 'LWPOLYLINE') {
                inLwPolyline = true;
                i++;
                continue;
            }

            if (inLwPolyline) {
                // Código de grupo 10 = X, 20 = Y
                if (lines[i] === '10' && i + 1 < lines.length) {
                    const x = parseFloat(lines[i + 1]);
                    // Busca Y correspondente
                    let j = i + 2;
                    while (j < lines.length && lines[j] !== '20') j++;
                    if (j + 1 < lines.length) {
                        const y = parseFloat(lines[j + 1]);
                        if (!isNaN(x) && !isNaN(y)) {
                            coords.push([x, y]);
                        }
                    }
                }
                if (lines[i] === '0' && lines[i + 1] !== 'LWPOLYLINE') {
                    inLwPolyline = false;
                    if (coords.length >= 3) break; // usa a primeira polyline encontrada
                }
            }
            i++;
        }

        if (coords.length < 3) return null;

        // Fecha o polígono
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push([...first]);
        }

        const wktCoords = coords.map(([lon, lat]) => `${lon} ${lat}`).join(', ');
        return `SRID=4674;POLYGON((${wktCoords}))`;
    } catch (error) {
        console.error('Erro ao parsear DXF:', error);
        return null;
    }
}

/**
 * Detecta o tipo de arquivo e parseia → WKT
 */
export async function parseGeoFile(file: File): Promise<string | null> {
    const ext = file.name.toLowerCase().split('.').pop();
    const text = await file.text();

    switch (ext) {
        case 'kml':
        case 'kmz':
            return parseKML(text);
        case 'geojson':
        case 'json':
            return parseGeoJSON(text);
        case 'dxf':
            return parseDXF(text);
        default:
            console.warn(`Formato não suportado: .${ext}`);
            return null;
    }
}
