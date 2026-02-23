/**
 * useToolExecution — Hook central para execucao de ferramentas CAD no mapa
 * Recebe map (MapLibre) + activeTool, attach/detach event handlers
 * Geometria via Turf.js (substitui ArcGIS geometryEngine)
 */

import { useEffect, useRef, useCallback } from 'react';
import type { ToolId, ToolResult } from '../types/tools';
import type { Feature, Polygon } from 'geojson';
import * as turf from '@turf/turf';
import maplibregl from 'maplibre-gl';
import { getOrCreateToolLayer, renderBuffer, renderSplitPolygons, renderGeometryResult, renderMeasurementPoint, renderMeasurementLine, clearToolLayer, findAllPolygons } from '../lib/geometry/GeometryUtils';
import { calculateAngle, calculateAzimuth } from '../lib/geometry/AngleCalculation';
import { geographicToSIRGASUTM, toDMS } from '../lib/geometry/CoordinateConversion';
import { validatePolygonTopology, detectGaps, validateMultiPolygonTopology } from '../lib/geometry/TopologyValidation';
import { parseGeoFile } from '../lib/file-parsers';

interface UseToolExecutionOptions {
  map: maplibregl.Map | null;
  activeTool: ToolId | null;
  onToolResult: (result: ToolResult) => void;
  onToolError?: (error: string) => void;
  onToolInfo?: (info: string) => void;
  bufferDistance?: number;
}

function toTurfPolygon(geometry: maplibregl.MapGeoJSONFeature | null | undefined): Feature<Polygon> | null {
  if (!geometry || geometry.geometry.type !== 'Polygon') return null;
  return { type: 'Feature', geometry: geometry.geometry as Polygon, properties: geometry.properties || {} };
}

function queryPolygon(map: maplibregl.Map, point: maplibregl.Point): Feature<Polygon> | null {
  const features = map.queryRenderedFeatures(point);
  const found = features.find(f => f.geometry.type === 'Polygon');
  return found ? toTurfPolygon(found) : null;
}

export function useToolExecution({
  map,
  activeTool,
  onToolResult,
  onToolError,
  onToolInfo,
  bufferDistance = 10,
}: UseToolExecutionOptions) {
  const handlersRef = useRef<(() => void)[]>([]);
  const clickPointsRef = useRef<[number, number][]>([]);
  const selectedFeaturesRef = useRef<Feature<Polygon>[]>([]);

  const cleanup = useCallback(() => {
    handlersRef.current.forEach(off => off());
    handlersRef.current = [];
    clickPointsRef.current = [];
    selectedFeaturesRef.current = [];
  }, []);

  useEffect(() => {
    if (!map || !activeTool) {
      cleanup();
      return;
    }

    // Wait until map is loaded before attaching handlers
    const run = () => {
      cleanup();

      switch (activeTool) {
        // ═══════════════════════════════════════════
        // MEDICAO
        // ═══════════════════════════════════════════
        case 'area': {
          onToolInfo?.('Clique em um poligono para medir a area');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const poly = queryPolygon(map, e.point);
            if (poly) {
              const area = turf.area(poly);
              const hectares = area / 10000;
              onToolResult({
                type: 'area', value: area, unit: 'm2',
                details: { hectares: hectares.toFixed(4), m2: area.toFixed(2) },
              });
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        case 'perimetro': {
          onToolInfo?.('Clique em um poligono para medir o perimetro');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const poly = queryPolygon(map, e.point);
            if (poly) {
              const perimeter = turf.length(poly, { units: 'kilometers' }) * 1000;
              onToolResult({
                type: 'perimetro', value: perimeter, unit: 'm',
                details: { metros: perimeter.toFixed(2), km: (perimeter / 1000).toFixed(4) },
              });
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        case 'angulo': {
          onToolInfo?.('Clique em 3 pontos: P1, Vertice, P2');
          const sourceId = getOrCreateToolLayer(map, 'tool-angle-layer');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
            clickPointsRef.current.push(coords);
            renderMeasurementPoint(map, sourceId, coords);

            if (clickPointsRef.current.length === 2) {
              renderMeasurementLine(map, sourceId, [clickPointsRef.current[0], clickPointsRef.current[1]]);
            }
            if (clickPointsRef.current.length >= 3) {
              const [p1, vertex, p2] = clickPointsRef.current;
              const angle = calculateAngle(p1, vertex, p2);
              renderMeasurementLine(map, sourceId, [vertex, p2]);
              onToolResult({
                type: 'angulo', value: angle, unit: 'graus',
                details: { graus: angle.toFixed(4), radianos: (angle * Math.PI / 180).toFixed(6) },
              });
              clickPointsRef.current = [];
              setTimeout(() => clearToolLayer(map, sourceId), 3000);
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        case 'azimute': {
          onToolInfo?.('Clique em 2 pontos para medir o azimute');
          const sourceId = getOrCreateToolLayer(map, 'tool-azimuth-layer');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
            clickPointsRef.current.push(coords);
            renderMeasurementPoint(map, sourceId, coords);
            if (clickPointsRef.current.length >= 2) {
              const [p1, p2] = clickPointsRef.current;
              const azimuth = calculateAzimuth(p1, p2);
              renderMeasurementLine(map, sourceId, [p1, p2], [0, 150, 255]);
              onToolResult({
                type: 'azimute', value: azimuth, unit: 'graus',
                details: { graus: azimuth.toFixed(4), direcao: getCompassDirection(azimuth) },
              });
              clickPointsRef.current = [];
              setTimeout(() => clearToolLayer(map, sourceId), 3000);
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        case 'coordenadas': {
          onToolInfo?.('Mova o cursor sobre o mapa para ver as coordenadas');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const lon = e.lngLat.lng;
            const lat = e.lngLat.lat;
            const [easting, northing] = geographicToSIRGASUTM(lon, lat);
            onToolResult({
              type: 'coordenadas',
              value: `${lat.toFixed(8)}, ${lon.toFixed(8)}`,
              details: {
                lat: lat.toFixed(8), lon: lon.toFixed(8),
                dmsLat: toDMS(lat, true), dmsLon: toDMS(lon, false),
                utmE: easting.toFixed(2), utmN: northing.toFixed(2),
              },
            });
          };
          map.on('mousemove', handler);
          handlersRef.current.push(() => map.off('mousemove', handler));
          break;
        }

        // ═══════════════════════════════════════════
        // EDICAO
        // ═══════════════════════════════════════════
        case 'buffer': {
          onToolInfo?.(`Clique em um poligono para criar buffer de ${bufferDistance}m`);
          const sourceId = getOrCreateToolLayer(map, 'tool-buffer-layer');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const poly = queryPolygon(map, e.point);
            if (poly) {
              const buffered = turf.buffer(poly, bufferDistance / 1000, { units: 'kilometers' });
              if (buffered) {
                renderBuffer(map, sourceId, buffered as Feature<Polygon>);
                const bufferArea = turf.area(buffered);
                onToolResult({
                  type: 'buffer', value: bufferArea, unit: 'm2',
                  details: { distancia: `${bufferDistance}m`, area: bufferArea.toFixed(2) },
                });
              }
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        case 'dividir': {
          onToolInfo?.('Clique em 2 pontos para criar a linha de corte');
          const sourceId = getOrCreateToolLayer(map, 'tool-split-layer');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
            clickPointsRef.current.push(coords);
            renderMeasurementPoint(map, sourceId, coords, [255, 0, 0]);

            if (clickPointsRef.current.length >= 2) {
              const [p1, p2] = clickPointsRef.current;
              renderMeasurementLine(map, sourceId, [p1, p2], [255, 0, 0]);

              const poly = queryPolygon(map, e.point);
              if (poly) {
                try {
                  // Split using a line extended through the polygon
                  const line = turf.lineString([p1, p2]);
                  const bbox = turf.bbox(poly);
                  const extendedLine = turf.lineString([
                    [bbox[0] - 0.01, p1[1] + (p2[1] - p1[1]) * ((bbox[0] - 0.01 - p1[0]) / (p2[0] - p1[0]) || 0)],
                    [bbox[2] + 0.01, p2[1] + (p2[1] - p1[1]) * ((bbox[2] + 0.01 - p1[0]) / (p2[0] - p1[0]) || 0)],
                  ]);
                  const mask = turf.bboxPolygon([bbox[0] - 0.1, bbox[1] - 0.1, (p1[0] + p2[0]) / 2, bbox[3] + 0.1]);
                  const half1 = turf.intersect(turf.featureCollection([poly, mask]));
                  const half2 = turf.difference(turf.featureCollection([poly, mask]));
                  if (half1 && half2) {
                    renderSplitPolygons(map, sourceId, half1 as Feature<Polygon>, half2 as Feature<Polygon>);
                    onToolResult({ type: 'dividir', value: 'Poligono dividido com sucesso', details: { partes: 2 } });
                  } else {
                    onToolError?.('Linha de corte nao intercepta o poligono');
                  }
                } catch {
                  onToolError?.('Erro ao dividir poligono');
                }
              } else {
                onToolError?.('Nenhum poligono encontrado no ponto clicado');
              }
              clickPointsRef.current = [];
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        case 'unir': {
          onToolInfo?.('Clique em 2 ou mais poligonos, depois pressione Enter para unir');
          const sourceId = getOrCreateToolLayer(map, 'tool-union-layer');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const poly = queryPolygon(map, e.point);
            if (poly) {
              selectedFeaturesRef.current.push(poly);
              renderGeometryResult(map, sourceId, poly, [33, 150, 243]);
              onToolInfo?.(`${selectedFeaturesRef.current.length} poligono(s) selecionado(s). Clique mais ou pressione Enter para unir.`);
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));

          const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && selectedFeaturesRef.current.length >= 2) {
              try {
                const united = turf.union(turf.featureCollection(selectedFeaturesRef.current));
                if (united) {
                  renderGeometryResult(map, sourceId, united, [76, 175, 80]);
                  const area = turf.area(united);
                  onToolResult({
                    type: 'unir', value: 'Poligonos unidos com sucesso',
                    details: { poligonos: selectedFeaturesRef.current.length, areaTotal: area.toFixed(2) },
                  });
                }
              } catch (err) {
                onToolError?.(`Erro ao unir: ${err}`);
              }
              selectedFeaturesRef.current = [];
            }
          };
          window.addEventListener('keydown', keyHandler);
          handlersRef.current.push(() => window.removeEventListener('keydown', keyHandler));
          break;
        }

        case 'simplificar': {
          onToolInfo?.('Clique em um poligono para simplificar');
          const sourceId = getOrCreateToolLayer(map, 'tool-general-layer');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const poly = queryPolygon(map, e.point);
            if (poly) {
              const verticesBefore = poly.geometry.coordinates[0]?.length || 0;
              const simplified = turf.simplify(poly, { tolerance: 0.00005, highQuality: false });
              const verticesAfter = simplified.geometry.coordinates[0]?.length || 0;
              renderGeometryResult(map, sourceId, simplified, [0, 188, 212]);
              onToolResult({
                type: 'simplificar',
                value: `Simplificado: ${verticesBefore} → ${verticesAfter} vertices`,
                details: { antes: verticesBefore, depois: verticesAfter },
              });
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        // ═══════════════════════════════════════════
        // TOPOLOGIA
        // ═══════════════════════════════════════════
        case 'validar-topologia': {
          onToolInfo?.('Clique em um poligono para validar topologia');
          const sourceId = getOrCreateToolLayer(map, 'tool-topology-layer');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const poly = queryPolygon(map, e.point);
            if (poly) {
              const result = validatePolygonTopology(poly);
              renderGeometryResult(map, sourceId, poly, result.valid ? [76, 175, 80] : [244, 67, 54]);
              onToolResult({
                type: 'validar-topologia',
                value: result.valid ? 'Topologia valida' : `${result.errors.length} erro(s) encontrado(s)`,
                details: { valido: result.valid, erros: result.errors.map(err => `[${err.severity}] ${err.message}`) },
              });
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        case 'fechar-gaps': {
          onToolInfo?.('Analisando gaps entre todos os poligonos visiveis...');
          const polygons = findAllPolygons(map);
          if (polygons.length < 2) {
            onToolError?.('Necessario pelo menos 2 poligonos para detectar gaps');
          } else {
            const gaps = detectGaps(polygons);
            onToolResult({
              type: 'fechar-gaps',
              value: gaps.length === 0 ? 'Nenhum gap detectado' : `${gaps.length} gap(s) detectado(s)`,
              details: { totalPoligonos: polygons.length, gaps: gaps.map(g => g.message) },
            });
          }
          break;
        }

        case 'simplificar-topologia': {
          onToolInfo?.('Validando topologia de todos os poligonos...');
          const polygons = findAllPolygons(map);
          if (polygons.length === 0) {
            onToolError?.('Nenhum poligono encontrado');
          } else {
            const result = validateMultiPolygonTopology(polygons);
            onToolResult({
              type: 'simplificar-topologia',
              value: result.valid ? 'Topologia geral valida' : `${result.errors.length} problema(s)`,
              details: {
                valido: result.valid, totalPoligonos: polygons.length,
                erros: result.errors.map(err => `[${err.severity}] ${err.message}`),
              },
            });
          }
          break;
        }

        // ═══════════════════════════════════════════
        // IMPORT / EXPORT
        // ═══════════════════════════════════════════
        case 'importar-kml':
        case 'importar-geojson': {
          const accept = activeTool === 'importar-kml' ? '.kml,.kmz' : '.geojson,.json';
          onToolInfo?.(`Selecione um arquivo ${activeTool === 'importar-kml' ? 'KML/KMZ' : 'GeoJSON'}...`);
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = accept;
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
              const geojson = await parseGeoFile(file);
              if (geojson) {
                onToolResult({
                  type: activeTool, value: `Arquivo "${file.name}" importado com sucesso`,
                  geometry: geojson, details: { fileName: file.name, type: geojson.type },
                });
              } else {
                onToolError?.(`Nao foi possivel processar o arquivo "${file.name}"`);
              }
            } catch (err) {
              onToolError?.(`Erro ao importar: ${err}`);
            }
          };
          input.click();
          break;
        }

        case 'exportar-geojson': {
          onToolInfo?.('Clique em um poligono para exportar como GeoJSON');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const poly = queryPolygon(map, e.point);
            if (poly) {
              const blob = new Blob([JSON.stringify(poly, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'export.geojson'; a.click();
              URL.revokeObjectURL(url);
              onToolResult({ type: 'exportar-geojson', value: 'GeoJSON exportado com sucesso' });
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        case 'exportar-dxf': {
          onToolInfo?.('Exportacao DXF requer backend. Clique em um poligono para exportar.');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const poly = queryPolygon(map, e.point);
            if (poly) onToolError?.('Exportacao DXF: backend nao configurado ainda');
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        // ═══════════════════════════════════════════
        // SIGEF + COORDENADAS
        // ═══════════════════════════════════════════
        case 'sigef-validar': {
          onToolInfo?.('Clique em um poligono para validar contra regras SIGEF');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const poly = queryPolygon(map, e.point);
            if (poly) {
              const area = turf.area(poly);
              const areaHa = area / 10000;
              const ring = poly.geometry.coordinates[0] || [];
              const vertexCount = ring.length;
              const erros: string[] = [];
              const avisos: string[] = [];
              if (vertexCount < 4) erros.push('Minimo 3 vertices unicos necessarios');
              if (area < 1) erros.push('Area minima nao atingida');
              try { if (turf.kinks(poly).features.length > 0) erros.push('Geometria possui auto-interseccao'); } catch { }
              if (areaHa > 100000) avisos.push('Area muito grande - verificar precisao');
              onToolResult({
                type: 'sigef-validar',
                value: erros.length === 0 ? 'Geometria compativel com SIGEF' : `${erros.length} erro(s) SIGEF`,
                details: { valido: erros.length === 0, erros, avisos, areaHa: areaHa.toFixed(4), vertices: vertexCount },
              });
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        case 'sigef-memorial': {
          onToolInfo?.('Clique em um poligono para gerar memorial descritivo');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const poly = queryPolygon(map, e.point);
            if (poly) {
              const ring = poly.geometry.coordinates[0] || [];
              const area = turf.area(poly);
              let memorial = `MEMORIAL DESCRITIVO\n`;
              memorial += `Area: ${area.toFixed(2)} m2 (${(area / 10000).toFixed(4)} ha)\n`;
              memorial += `Vertices: ${ring.length - 1}\n\n`;
              memorial += `TABELA DE COORDENADAS (SIRGAS 2000 / UTM)\n`;
              memorial += `Vertice | Longitude | Latitude | E (UTM) | N (UTM)\n`;
              memorial += `--------|-----------|----------|---------|--------\n`;
              for (let i = 0; i < ring.length - 1; i++) {
                const [lon, lat] = ring[i];
                const [utmE, utmN] = geographicToSIRGASUTM(lon, lat);
                memorial += `V${i + 1} | ${lon.toFixed(8)} | ${lat.toFixed(8)} | ${utmE.toFixed(2)} | ${utmN.toFixed(2)}\n`;
              }
              onToolResult({
                type: 'sigef-memorial', value: 'Memorial gerado com sucesso',
                details: { memorial, area: area.toFixed(2), vertices: ring.length - 1 },
              });
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        case 'sigef-vertices': {
          onToolInfo?.('Clique em um poligono para extrair vertices SIRGAS');
          const handler = (e: maplibregl.MapMouseEvent) => {
            const poly = queryPolygon(map, e.point);
            if (poly) {
              const ring = poly.geometry.coordinates[0] || [];
              const vertices = ring.slice(0, -1).map((coord, i) => {
                const [lon, lat] = coord;
                const [utmE, utmN] = geographicToSIRGASUTM(lon, lat);
                return {
                  id: `V${i + 1}`,
                  lon: lon.toFixed(8), lat: lat.toFixed(8),
                  utmE: utmE.toFixed(2), utmN: utmN.toFixed(2),
                  dmsLon: toDMS(lon, false), dmsLat: toDMS(lat, true),
                };
              });
              onToolResult({
                type: 'sigef-vertices', value: `${vertices.length} vertices extraidos`,
                details: { vertices, totalVertices: vertices.length },
              });
            }
          };
          map.on('click', handler);
          handlersRef.current.push(() => map.off('click', handler));
          break;
        }

        case 'converter-coords':
        case 'adicionar-ponto': {
          onToolInfo?.('Use o formulario no painel lateral');
          break;
        }

        default:
          break;
      }
    };

    if (map.loaded()) {
      run();
    } else {
      map.once('load', run);
    }

    return cleanup;
  }, [map, activeTool, bufferDistance, cleanup, onToolResult, onToolError, onToolInfo]);
}

function getCompassDirection(azimuth: number): string {
  if (azimuth >= 337.5 || azimuth < 22.5) return 'N';
  if (azimuth >= 22.5 && azimuth < 67.5) return 'NE';
  if (azimuth >= 67.5 && azimuth < 112.5) return 'E';
  if (azimuth >= 112.5 && azimuth < 157.5) return 'SE';
  if (azimuth >= 157.5 && azimuth < 202.5) return 'S';
  if (azimuth >= 202.5 && azimuth < 247.5) return 'SW';
  if (azimuth >= 247.5 && azimuth < 292.5) return 'W';
  return 'NW';
}
