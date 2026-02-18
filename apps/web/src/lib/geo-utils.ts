/**
 * geo-utils.ts — Utilidades geoespaciais para conversões WKT ↔ ArcGIS
 * SRID: 4674 (SIRGAS 2000) — compatível com 4326 (WGS84) para visualização
 */

/**
 * Converte WKT POLYGON para array de rings [lon, lat]
 * Suporta: POLYGON((...)), SRID=4674;POLYGON((...))
 */
export function wktToRings(wkt: string): number[][][] | null {
    if (!wkt) return null;
    try {
        // Remove SRID prefix se existir
        const clean = wkt.replace(/^SRID=\d+;/i, '');
        const match = clean.match(/POLYGON\s*\(\((.*?)\)\)/i);
        if (!match) return null;

        const coordsStr = match[1];
        const ring = coordsStr.split(',').map((pair) => {
            const [lon, lat] = pair.trim().split(/\s+/).map(Number);
            return [lon, lat];
        });

        return [ring];
    } catch (error) {
        console.error('Erro ao converter WKT:', error);
        return null;
    }
}

/**
 * Converte rings [lon, lat] para WKT com prefixo SRID
 */
export function ringsToWkt(rings: number[][]): string {
    if (!rings || rings.length === 0) return '';
    const pairs = rings.map(([lon, lat]) => `${lon} ${lat}`).join(', ');
    return `SRID=4674;POLYGON((${pairs}))`;
}

/**
 * Calcula o centróide de um polígono
 */
export function calculateCentroid(rings: number[][]): [number, number] {
    if (!rings || rings.length === 0) return [-47.93, -15.78]; // Default: Brasília

    let sumLon = 0, sumLat = 0;
    const n = rings.length;
    for (const [lon, lat] of rings) {
        sumLon += lon;
        sumLat += lat;
    }
    return [sumLon / n, sumLat / n];
}

/**
 * Calcula a área aproximada em m² usando fórmula do Shoelace
 * (suficiente para polígonos pequenos em graus)
 */
export function calculateAreaM2(rings: number[][]): number {
    if (!rings || rings.length < 3) return 0;

    let area = 0;
    const n = rings.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += rings[i][0] * rings[j][1];
        area -= rings[j][0] * rings[i][1];
    }
    area = Math.abs(area) / 2;

    // Converter graus² → m² (aprox. para latitude média brasileira)
    const midLat = rings.reduce((s, r) => s + r[1], 0) / n;
    const degToMAtLat = 111320 * Math.cos(midLat * Math.PI / 180);
    const degToMVertical = 110540;

    return area * degToMAtLat * degToMVertical;
}

/**
 * Calcula o perímetro em metros
 */
export function calculatePerimeterM(rings: number[][]): number {
    if (!rings || rings.length < 2) return 0;

    let perim = 0;
    const midLat = rings.reduce((s, r) => s + r[1], 0) / rings.length;
    const degToMH = 111320 * Math.cos(midLat * Math.PI / 180);
    const degToMV = 110540;

    for (let i = 0; i < rings.length - 1; i++) {
        const dx = (rings[i + 1][0] - rings[i][0]) * degToMH;
        const dy = (rings[i + 1][1] - rings[i][1]) * degToMV;
        perim += Math.sqrt(dx * dx + dy * dy);
    }
    return perim;
}
