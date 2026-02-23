/**
 * GeometryUtils: Funcoes utilitarias gerais de geometria
 * Usa MapLibre GL JS para renderizacao no lugar do ArcGIS.
 */

import maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, Polygon, LineString, Point, Geometry } from 'geojson';

// Cache interno de dados de cada source tool
const _sourceCache = new Map<string, FeatureCollection>();

const TEMP_LAYER_IDS = [
  'tool-split-layer',
  'tool-merge-layer',
  'tool-buffer-layer',
  'tool-intersection-layer',
  'tool-union-layer',
  'tool-measurements-layer',
  'tool-area-layer',
  'tool-angle-layer',
  'tool-azimuth-layer',
  'tool-selection-layer',
  'tool-coords-layer',
  'tool-topology-layer',
  'tool-import-layer',
  'tool-general-layer',
];

function _setData(map: maplibregl.Map, sourceId: string, data: FeatureCollection) {
  _sourceCache.set(sourceId, data);
  const src = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData(data);
}

function _getFeatures(sourceId: string): Feature[] {
  return _sourceCache.get(sourceId)?.features ?? [];
}

export function getOrCreateToolLayer(map: maplibregl.Map, layerId: string): string {
  const sourceId = `${layerId}-source`;
  if (!map.getSource(sourceId)) {
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
    map.addSource(sourceId, { type: 'geojson', data: empty });
    _sourceCache.set(sourceId, empty);

    map.addLayer({
      id: `${layerId}-fill`,
      type: 'fill',
      source: sourceId,
      filter: ['==', '$type', 'Polygon'],
      paint: { 'fill-color': '#9c27b0', 'fill-opacity': 0.4 },
    });
    map.addLayer({
      id: `${layerId}-line`,
      type: 'line',
      source: sourceId,
      paint: { 'line-color': '#9c27b0', 'line-width': 2 },
    });
    map.addLayer({
      id: `${layerId}-circle`,
      type: 'circle',
      source: sourceId,
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-color': '#9c27b0',
        'circle-radius': 5,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff',
      },
    });
  }
  return sourceId;
}

export function clearToolLayer(map: maplibregl.Map, sourceId: string) {
  _setData(map, sourceId, { type: 'FeatureCollection', features: [] });
}

export function clearTemporaryLayers(map: maplibregl.Map) {
  TEMP_LAYER_IDS.forEach(id => {
    const sourceId = `${id}-source`;
    if (map.getSource(sourceId)) clearToolLayer(map, sourceId);
  });
}

function _applyColor(map: maplibregl.Map, layerId: string, color: [number, number, number]) {
  const css = `rgb(${color[0]},${color[1]},${color[2]})`;
  if (map.getLayer(`${layerId}-fill`)) map.setPaintProperty(`${layerId}-fill`, 'fill-color', css);
  if (map.getLayer(`${layerId}-line`)) map.setPaintProperty(`${layerId}-line`, 'line-color', css);
  if (map.getLayer(`${layerId}-circle`)) map.setPaintProperty(`${layerId}-circle`, 'circle-color', css);
}

export function renderSplitPolygons(
  map: maplibregl.Map,
  sourceId: string,
  poly1: Feature<Polygon>,
  poly2: Feature<Polygon>
) {
  const p1 = { ...poly1, properties: { ...(poly1.properties || {}), _half: '1' } };
  const p2 = { ...poly2, properties: { ...(poly2.properties || {}), _half: '2' } };
  const layerId = sourceId.replace('-source', '');
  if (map.getLayer(`${layerId}-fill`)) {
    map.setPaintProperty(`${layerId}-fill`, 'fill-color', [
      'match', ['get', '_half'], '1', '#4caf50', '#2196f3',
    ]);
  }
  _setData(map, sourceId, { type: 'FeatureCollection', features: [p1, p2] });
}

export function renderBuffer(
  map: maplibregl.Map,
  sourceId: string,
  buffer: Feature<Polygon>
) {
  const layerId = sourceId.replace('-source', '');
  if (map.getLayer(`${layerId}-fill`)) {
    map.setPaintProperty(`${layerId}-fill`, 'fill-color', '#ff9800');
    map.setPaintProperty(`${layerId}-fill`, 'fill-opacity', 0.3);
  }
  if (map.getLayer(`${layerId}-line`)) {
    map.setPaintProperty(`${layerId}-line`, 'line-color', '#ff9800');
    map.setPaintProperty(`${layerId}-line`, 'line-dasharray', [2, 2]);
  }
  _setData(map, sourceId, { type: 'FeatureCollection', features: [buffer] });
}

export function renderGeometryResult(
  map: maplibregl.Map,
  sourceId: string,
  geometry: Feature,
  color: [number, number, number] = [156, 39, 176]
) {
  _applyColor(map, sourceId.replace('-source', ''), color);
  _setData(map, sourceId, { type: 'FeatureCollection', features: [geometry] });
}

export function renderMeasurementPoint(
  map: maplibregl.Map,
  sourceId: string,
  coords: [number, number],
  color: [number, number, number] = [255, 0, 0]
) {
  _applyColor(map, sourceId.replace('-source', ''), color);
  const pt: Feature<Point> = { type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} };
  const existing = _getFeatures(sourceId);
  _setData(map, sourceId, { type: 'FeatureCollection', features: [...existing, pt] });
}

export function renderMeasurementLine(
  map: maplibregl.Map,
  sourceId: string,
  coords: [number, number][],
  color: [number, number, number] = [255, 165, 0]
) {
  _applyColor(map, sourceId.replace('-source', ''), color);
  const line: Feature<LineString> = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} };
  const existing = _getFeatures(sourceId);
  _setData(map, sourceId, { type: 'FeatureCollection', features: [...existing, line] });
}

/**
 * Calculate distance between two points (Haversine formula)
 */
export function calculateDistance(p1: [number, number], p2: [number, number]): number {
  const [lon1, lat1] = p1;
  const [lon2, lat2] = p2;
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the first visible polygon in the map (center of viewport)
 */
export function findSelectedPolygon(map: maplibregl.Map): Feature<Polygon> | null {
  const el = map.getContainer();
  const pt: [number, number] = [el.clientWidth / 2, el.clientHeight / 2];
  const features = map.queryRenderedFeatures(pt);
  const found = features.find(f => f.geometry.type === 'Polygon');
  return found ? (found as unknown as Feature<Polygon>) : null;
}

/**
 * Find all polygons from the lotes-source
 */
export function findAllPolygons(map: maplibregl.Map): Feature<Polygon>[] {
  const stored = _sourceCache.get('lotes-source');
  if (stored) return stored.features.filter(f => f.geometry.type === 'Polygon') as Feature<Polygon>[];
  const features = map.queryRenderedFeatures();
  return features
    .filter(f => f.geometry.type === 'Polygon')
    .map(f => ({ type: 'Feature', geometry: f.geometry as Polygon, properties: f.properties || {} } as Feature<Polygon>));
}

/**
 * Expose the source cache so MapContainer can register lotes data
 */
export function registerSourceData(sourceId: string, data: FeatureCollection) {
  _sourceCache.set(sourceId, data);
}