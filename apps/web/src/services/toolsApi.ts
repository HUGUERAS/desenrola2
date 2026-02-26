/**
 * toolsApi.ts — Implementações client-side (sem backend)
 * SIGEF, Import/Export — tudo no browser via turf + @mapbox/togeojson
 */

import { kml as kmlToGeoJSON } from '@mapbox/togeojson';
import * as turf from '@turf/turf';

// ── Helpers ────────────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime = 'application/octet-stream') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── SIGEF ──────────────────────────────────────────────────────────────────────

export interface SIGEFValidationResult {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

export function validateSIGEF(
  _geomWkt: string,
  areaHectares: number,
  verticesSirgas: number[][],
): SIGEFValidationResult {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!verticesSirgas || verticesSirgas.length < 3) {
    erros.push('Mínimo de 3 vértices necessários.');
  }

  const first = verticesSirgas[0];
  const last = verticesSirgas[verticesSirgas.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    erros.push('Polígono não está fechado (primeiro ≠ último vértice).');
  }

  if (areaHectares <= 0) {
    erros.push('Área deve ser maior que zero.');
  }

  if (verticesSirgas.length > 0) {
    const coords = verticesSirgas.map(([x, y]) => [x, y] as [number, number]);
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }
    const poly = turf.polygon([coords]);
    const areaCalculada = turf.area(poly) / 10000; // m² → ha
    const diff = Math.abs(areaCalculada - areaHectares) / areaHectares;
    if (diff > 0.05) {
      avisos.push(`Área declarada (${areaHectares.toFixed(4)} ha) difere da calculada (${areaCalculada.toFixed(4)} ha) em ${(diff * 100).toFixed(1)}%.`);
    }
  }

  return { valido: erros.length === 0, erros, avisos };
}

export function generateMemorial(
  vertices: number[][],
  areaM2: number,
  confrontantes?: Record<string, string>,
): { memorial: string; tabela: string } {
  const areaHa = (areaM2 / 10000).toFixed(4);
  const confrontStr = confrontantes
    ? Object.entries(confrontantes).map(([lado, nome]) => `  - ${lado}: ${nome}`).join('\n')
    : '  (não informados)';

  const memorial = `MEMORIAL DESCRITIVO\n${'='.repeat(40)}\n\nÁrea total: ${areaM2.toFixed(2)} m² (${areaHa} ha)\n\nCONFRONTANTES:\n${confrontStr}\n\nVÉRTICES:\n${vertices.map((v, i) => `  V${i + 1}: E=${v[0].toFixed(3)} N=${v[1].toFixed(3)}`).join('\n')}\n`;

  const tabela = ['Vértice,E (m),N (m)', ...vertices.map((v, i) => `V${i + 1},${v[0].toFixed(3)},${v[1].toFixed(3)}`)].join('\n');

  return { memorial, tabela };
}

export function getVerticesSIRGAS(vertices: number[][]): { tabela: string } {
  const linhas = ['Vértice,Longitude,Latitude', ...vertices.map((v, i) => `V${i + 1},${v[0].toFixed(8)},${v[1].toFixed(8)}`)];
  return { tabela: linhas.join('\n') };
}

// ── Import ─────────────────────────────────────────────────────────────────────

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: string; coordinates: unknown };
    properties: Record<string, unknown>;
  }>;
}

export async function importKML(file: File): Promise<GeoJSONFeatureCollection> {
  const text = await file.text();
  const dom = new DOMParser().parseFromString(text, 'text/xml');
  return kmlToGeoJSON(dom) as GeoJSONFeatureCollection;
}

export async function importGeoJSON(file: File): Promise<GeoJSONFeatureCollection> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (parsed.type !== 'FeatureCollection') {
    if (parsed.type === 'Feature') return { type: 'FeatureCollection', features: [parsed] };
    if (parsed.type && parsed.coordinates) return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: parsed, properties: {} }] };
  }
  return parsed as GeoJSONFeatureCollection;
}

// ── Export ─────────────────────────────────────────────────────────────────────

export function exportGeoJSON(geometry: object): void {
  downloadBlob(JSON.stringify(geometry, null, 2), 'export.geojson', 'application/geo+json');
}

/**
 * Gera conteúdo DXF mínimo com LWPOLYLINE + TEXT por vértice.
 * @param ring  Array de coords [lon, lat] (anel fechado ou aberto)
 * @param labels  Map de vertexIndex → label customizado (opcional)
 * @param layerName  Nome da layer DXF (default: "LOTES")
 */
export function buildDXF(
  ring: number[][],
  labels: Map<number, string> = new Map(),
  layerName = 'LOTES',
): string {
  // ── LWPOLYLINE ────────────────────────────────────────────────
  const closed = 1; // flag fechado
  const pts = ring
    .map(([x, y]) => ` 10\n${x.toFixed(6)}\n 20\n${y.toFixed(6)}\n 30\n0.000000`)
    .join('\n');

  const polyline = [
    ` 0\nLWPOLYLINE`,
    ` 8\n${layerName}`,
    ` 70\n${closed}`,
    ` 90\n${ring.length}`,
    pts,
  ].join('\n');

  // ── TEXT por vértice ──────────────────────────────────────────
  // Gera texto para cada vértice (com label customizado ou padrão V<n>)
  const textHeight = 0.0001; // graus — ajustável
  const offsetY = textHeight * 1.2;
  const vertexTexts: string[] = [];

  const ringForLabel = ring[ring.length - 1][0] === ring[0][0] && ring[ring.length - 1][1] === ring[0][1]
    ? ring.slice(0, -1) // remove duplicata final
    : ring;

  for (let i = 0; i < ringForLabel.length; i++) {
    const [x, y] = ringForLabel[i];
    const label = labels.get(i) ?? `V${i + 1}`;
    vertexTexts.push([
      ` 0\nTEXT`,
      ` 8\nVERTICES`,   // layer separada
      ` 10\n${x.toFixed(6)}`,
      ` 20\n${(y + offsetY).toFixed(6)}`,
      ` 30\n0.000000`,
      ` 40\n${textHeight.toFixed(6)}`,
      `  1\n${label}`,
    ].join('\n'));
  }

  // ── POINT por vértice ─────────────────────────────────────────
  const points = ringForLabel.map(([x, y]) => [
    ` 0\nPOINT`,
    ` 8\nVERTICES`,
    ` 10\n${x.toFixed(6)}`,
    ` 20\n${y.toFixed(6)}`,
    ` 30\n0.000000`,
  ].join('\n'));

  const entities = [polyline, ...vertexTexts, ...points];

  return [
    `  0\nSECTION`,
    `  2\nHEADER`,
    `  9\n$ACADVER`,
    `  1\nAC1015`,   // AutoCAD 2000
    `  0\nENDSEC`,
    `  0\nSECTION`,
    `  2\nENTITIES`,
    entities.join('\n'),
    `  0\nENDSEC`,
    `  0\nEOF`,
  ].join('\n');
}

/** Exporta array de geometrias GeoJSON como DXF com download automático */
export function exportDXF(geometries: object[], labels: Map<number, string> = new Map()): void {
  const allRings: number[][][] = [];
  for (const geo of geometries) {
    const g = geo as { type?: string; coordinates?: number[][][] };
    const rings =
      g?.type === 'Polygon'
        ? g.coordinates ?? []
        : g?.type === 'MultiPolygon'
          ? (geo as { coordinates: number[][][][] }).coordinates.flat()
          : [];
    allRings.push(...rings);
  }

  if (allRings.length === 0) return;

  // Usa o maior anel como polígono principal
  const mainRing = allRings.reduce((a, b) => (a.length >= b.length ? a : b));
  downloadBlob(buildDXF(mainRing, labels), 'export.dxf');
}
