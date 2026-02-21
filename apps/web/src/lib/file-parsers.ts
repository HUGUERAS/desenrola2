/**
 * file-parsers.ts — Parsers de arquivos geoespaciais
 * Suporta: GeoJSON, KML, KMZ, DXF (LWPOLYLINE), CSV (SIRGAS 2000)
 */

/**
 * Parse geo file based on extension
 */
export async function parseGeoFile(file: File): Promise<Record<string, any> | null> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.geojson') || name.endsWith('.json')) {
    return parseGeoJSON(file);
  }

  if (name.endsWith('.kml')) {
    return parseKML(file);
  }

  if (name.endsWith('.kmz')) {
    return parseKMZ(file);
  }

  if (name.endsWith('.dxf')) {
    return parseDXF(file);
  }

  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return parseCSV(file);
  }

  return null;
}

/**
 * Parse GeoJSON file
 */
async function parseGeoJSON(file: File): Promise<Record<string, any> | null> {
  try {
    const text = await file.text();
    const json = JSON.parse(text);

    // Validate it's valid GeoJSON
    if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
      // Extract first polygon geometry
      const feature = json.features.find(
        (f: any) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
      );
      return feature?.geometry || json;
    }

    if (json.type === 'Feature' && json.geometry) {
      return json.geometry;
    }

    if (json.type === 'Polygon' || json.type === 'MultiPolygon') {
      return json;
    }

    return json;
  } catch {
    return null;
  }
}

/**
 * Parse KML file to GeoJSON geometry
 */
async function parseKML(file: File): Promise<Record<string, any> | null> {
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    // Find coordinates in Polygon
    const coordsElements = doc.querySelectorAll('coordinates');
    if (coordsElements.length === 0) return null;

    const coordinates: number[][] = [];

    // Parse first coordinates element (main polygon)
    const coordsText = coordsElements[0].textContent?.trim();
    if (!coordsText) return null;

    const coordPairs = coordsText.split(/\s+/);
    for (const pair of coordPairs) {
      const parts = pair.split(',').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        coordinates.push([parts[0], parts[1]]);
      }
    }

    if (coordinates.length < 3) return null;

    // Ensure ring is closed
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coordinates.push([...first]);
    }

    return {
      type: 'Polygon',
      coordinates: [coordinates],
    };
  } catch {
    return null;
  }
}

/**
 * Parse KMZ file (ZIP containing KML)
 */
async function parseKMZ(file: File): Promise<Record<string, any> | null> {
  try {
    // KMZ is a ZIP file - use JSZip if available, otherwise try as KML
    const arrayBuffer = await file.arrayBuffer();

    // Try to decompress using DecompressionStream (modern browsers)
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const blob = new Blob([arrayBuffer]);
        const ds = new DecompressionStream('deflate');
        const stream = blob.stream().pipeThrough(ds);
        const decompressed = await new Response(stream).text();
        const kmlFile = new File([decompressed], 'doc.kml');
        return parseKML(kmlFile);
      } catch {
        // Fallback: treat as plain KML
      }
    }

    // Fallback: try parsing as plain text KML
    const text = new TextDecoder().decode(arrayBuffer);
    if (text.includes('<kml') || text.includes('<coordinates')) {
      const kmlFile = new File([text], 'doc.kml');
      return parseKML(kmlFile);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Converte array de coordenadas [lon, lat][] em GeoJSON FeatureCollection
 */
function coordsToGeoJSONPolygon(coords: [number, number][]): Record<string, any> {
  const ring: [number, number][] = [...coords];
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (Math.abs(fx - lx) > 1e-10 || Math.abs(fy - ly) > 1e-10) {
    ring.push([fx, fy]);
  }
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    }],
  };
}

/**
 * Parse DXF file — extrai LWPOLYLINE e POLYLINE (frontend-only)
 * Compatível com exports do SIGEF / AutoCAD georreferenciado em SIRGAS 2000
 */
async function parseDXF(file: File): Promise<Record<string, any> | null> {
  try {
    const text = await file.text();
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    const allSets: [number, number][][] = [];
    let inPoly = false;
    let currentSet: [number, number][] = [];
    let pendingX: number | null = null;
    let inVertexSection = false; // Para POLYLINE com blocos VERTEX

    let i = 0;
    while (i < lines.length - 1) {
      const code = parseInt(lines[i].trim(), 10);
      const val = lines[i + 1]?.trim() ?? '';
      i += 2;

      if (isNaN(code)) continue;

      if (code === 0) {
        if (val === 'LWPOLYLINE' || val === 'POLYLINE') {
          if (inPoly && currentSet.length >= 3) allSets.push(currentSet);
          inPoly = true;
          inVertexSection = false;
          currentSet = [];
          pendingX = null;
        } else if (val === 'VERTEX' && inPoly) {
          inVertexSection = true;
          pendingX = null;
        } else if (val === 'SEQEND') {
          inVertexSection = false;
        } else if (inPoly && val !== 'VERTEX') {
          if (currentSet.length >= 3) allSets.push(currentSet);
          inPoly = false;
          currentSet = [];
        }
        continue;
      }

      if (inPoly) {
        if (code === 10) {
          pendingX = parseFloat(val);
        } else if (code === 20 && pendingX !== null) {
          currentSet.push([pendingX, parseFloat(val)]);
          pendingX = null;
        }
      }
    }

    if (inPoly && currentSet.length >= 3) allSets.push(currentSet);
    if (allSets.length === 0) return null;

    // Usa o maior conjunto de vértices
    const coords = allSets.reduce((a, b) => a.length >= b.length ? a : b);
    return coordsToGeoJSONPolygon(coords);
  } catch {
    return null;
  }
}

/**
 * Parse CSV/TXT com coordenadas geográficas em SIRGAS 2000
 *
 * Formatos aceitos:
 *   - Longitude;Latitude (ou separado por vírgula/tab)
 *   - VERTICE;X;Y;ALT (cabeçalho detectado automaticamente)
 *   - Lista de pares lon lat sem cabeçalho
 *
 * Auto-detecta: separador, colunas lon/lat por nome de cabeçalho ou posição.
 */
async function parseCSV(file: File): Promise<Record<string, any> | null> {
  try {
    const text = await file.text();
    const raw = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (raw.length < 3) return null;

    // Detecta separador
    const sep = raw[0].includes(';') ? ';' : raw[0].includes('\t') ? '\t' : ',';

    // Detecta colunas pelo cabeçalho
    const headers = raw[0].split(sep).map(h => h.trim().toLowerCase()
      .replace(/[()]/g, '').replace(/\s+/g, ''));
    const lonKeys = ['longitude', 'lon', 'x', 'xlongitude', 'long', 'xlon'];
    const latKeys = ['latitude', 'lat', 'y', 'ylatitude', 'ylat'];

    let lonIdx = headers.findIndex(h => lonKeys.some(k => h.includes(k)));
    let latIdx = headers.findIndex(h => latKeys.some(k => h.includes(k)));

    const dataStart = (lonIdx !== -1 && latIdx !== -1) ? 1 : 0;

    // Se não achou cabeçalho, detecta por posição nas primeiras linhas de dados
    if (lonIdx === -1 || latIdx === -1) {
      const sample = raw[dataStart].split(sep).map(p => parseFloat(p.trim().replace(',', '.')));
      // Brasil: lon ~ -74 a -28 ; lat ~ -34 a 5
      // Encontra dois índices com valores numéricos no range correto
      const iLon = sample.findIndex(n => !isNaN(n) && n >= -74 && n <= -28);
      const iLat = sample.findIndex((n, i) => !isNaN(n) && i !== iLon && n >= -34 && n <= 5);
      if (iLon === -1 || iLat === -1) return null;
      lonIdx = iLon;
      latIdx = iLat;
    }

    const coords: [number, number][] = [];
    for (let r = dataStart; r < raw.length; r++) {
      const parts = raw[r].split(sep).map(p => p.trim().replace(',', '.'));
      const lon = parseFloat(parts[lonIdx]);
      const lat = parseFloat(parts[latIdx]);
      if (!isNaN(lon) && !isNaN(lat)) coords.push([lon, lat]);
    }

    if (coords.length < 3) return null;
    return coordsToGeoJSONPolygon(coords);
  } catch {
    return null;
  }
}
