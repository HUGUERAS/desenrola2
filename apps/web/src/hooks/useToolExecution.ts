/**
 * useToolExecution — Hook central para execucao de ferramentas CAD no mapa
 * Recebe view + activeTool, attach/detach event handlers no MapView
 */

import { useEffect, useRef, useCallback } from 'react';
import type { ToolId, ToolResult } from '../types/tools';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
import Polyline from '@arcgis/core/geometry/Polyline';
import Point from '@arcgis/core/geometry/Point';
import { getOrCreateToolLayer, clearTemporaryLayers, renderBuffer, renderSplitPolygons, renderGeometryResult, renderMeasurementPoint, renderMeasurementLine } from '../lib/geometry/GeometryUtils';
import { calculateAngle, calculateAzimuth } from '../lib/geometry/AngleCalculation';
import { geographicToSIRGASUTM, toDMS } from '../lib/geometry/CoordinateConversion';
import { validatePolygonTopology, detectGaps, validateMultiPolygonTopology } from '../lib/geometry/TopologyValidation';
import { parseGeoFile } from '../lib/file-parsers';

interface UseToolExecutionOptions {
  view: __esri.MapView | null;
  activeTool: ToolId | null;
  onToolResult: (result: ToolResult) => void;
  onToolError?: (error: string) => void;
  onToolInfo?: (info: string) => void;
  bufferDistance?: number;
}

export function useToolExecution({
  view,
  activeTool,
  onToolResult,
  onToolError,
  onToolInfo,
  bufferDistance = 10,
}: UseToolExecutionOptions) {
  const handlersRef = useRef<__esri.Handle[]>([]);
  const clickPointsRef = useRef<[number, number][]>([]);
  const selectedGraphicsRef = useRef<__esri.Graphic[]>([]);

  const cleanup = useCallback(() => {
    handlersRef.current.forEach(h => h.remove());
    handlersRef.current = [];
    clickPointsRef.current = [];
    selectedGraphicsRef.current = [];
  }, []);

  useEffect(() => {
    if (!view || !activeTool) {
      cleanup();
      return;
    }

    view.when(() => {
      cleanup();

      switch (activeTool) {
        // ═══════════════════════════════════════════
        // MEDICAO
        // ═══════════════════════════════════════════
        case 'area': {
          onToolInfo?.('Clique em um poligono para medir a area');
          const handler = view.on('click', async (e) => {
            const hitResult = await view.hitTest(e);
            const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');
            if (graphicHit && graphicHit.type === 'graphic') {
              const geom = graphicHit.graphic.geometry as __esri.Polygon;
              const area = Math.abs(geometryEngine.geodesicArea(geom, 'square-meters'));
              const hectares = area / 10000;
              onToolResult({
                type: 'area',
                value: area,
                unit: 'm2',
                details: { hectares: hectares.toFixed(4), m2: area.toFixed(2) },
              });
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        case 'perimetro': {
          onToolInfo?.('Clique em um poligono para medir o perimetro');
          const handler = view.on('click', async (e) => {
            const hitResult = await view.hitTest(e);
            const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');
            if (graphicHit && graphicHit.type === 'graphic') {
              const geom = graphicHit.graphic.geometry as __esri.Polygon;
              const perimeter = geometryEngine.geodesicLength(geom, 'meters');
              onToolResult({
                type: 'perimetro',
                value: perimeter,
                unit: 'm',
                details: { metros: perimeter.toFixed(2), km: (perimeter / 1000).toFixed(4) },
              });
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        case 'angulo': {
          onToolInfo?.('Clique em 3 pontos: P1, Vertice, P2');
          const toolLayer = getOrCreateToolLayer(view, 'tool-angle-layer');

          const handler = view.on('click', (e) => {
            const geo = webMercatorUtils.webMercatorToGeographic(e.mapPoint) as __esri.Point;
            const coords: [number, number] = [geo.longitude as number, geo.latitude as number];
            clickPointsRef.current.push(coords);

            renderMeasurementPoint(toolLayer, new Point({ longitude: coords[0], latitude: coords[1] }));

            if (clickPointsRef.current.length === 2) {
              // Draw line from first to second point
              const line = new Polyline({
                paths: [[clickPointsRef.current[0], clickPointsRef.current[1]]],
                spatialReference: { wkid: 4326 },
              });
              renderMeasurementLine(toolLayer, line);
            }

            if (clickPointsRef.current.length >= 3) {
              const [p1, vertex, p2] = clickPointsRef.current;
              const angle = calculateAngle(p1, vertex, p2);

              // Draw line from vertex to P2
              const line2 = new Polyline({
                paths: [[vertex, p2]],
                spatialReference: { wkid: 4326 },
              });
              renderMeasurementLine(toolLayer, line2);

              onToolResult({
                type: 'angulo',
                value: angle,
                unit: 'graus',
                details: { graus: angle.toFixed(4), radianos: (angle * Math.PI / 180).toFixed(6) },
              });

              clickPointsRef.current = [];
              setTimeout(() => toolLayer.removeAll(), 3000);
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        case 'azimute': {
          onToolInfo?.('Clique em 2 pontos para medir o azimute');
          const toolLayer = getOrCreateToolLayer(view, 'tool-azimuth-layer');

          const handler = view.on('click', (e) => {
            const geo = webMercatorUtils.webMercatorToGeographic(e.mapPoint) as __esri.Point;
            const coords: [number, number] = [geo.longitude as number, geo.latitude as number];
            clickPointsRef.current.push(coords);

            renderMeasurementPoint(toolLayer, new Point({ longitude: coords[0], latitude: coords[1] }));

            if (clickPointsRef.current.length >= 2) {
              const [p1, p2] = clickPointsRef.current;
              const azimuth = calculateAzimuth(p1, p2);

              const line = new Polyline({
                paths: [[p1, p2]],
                spatialReference: { wkid: 4326 },
              });
              renderMeasurementLine(toolLayer, line, [0, 150, 255]);

              onToolResult({
                type: 'azimute',
                value: azimuth,
                unit: 'graus',
                details: { graus: azimuth.toFixed(4), direcao: getCompassDirection(azimuth) },
              });

              clickPointsRef.current = [];
              setTimeout(() => toolLayer.removeAll(), 3000);
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        case 'coordenadas': {
          onToolInfo?.('Mova o cursor sobre o mapa para ver as coordenadas');
          const handler = view.on('pointer-move', (e) => {
            const pt = view.toMap(e);
            if (pt) {
              const geo = webMercatorUtils.webMercatorToGeographic(pt) as __esri.Point;
              const lon = geo.longitude as number;
              const lat = geo.latitude as number;
              const [easting, northing] = geographicToSIRGASUTM(lon, lat);
              onToolResult({
                type: 'coordenadas',
                value: `${lat.toFixed(8)}, ${lon.toFixed(8)}`,
                details: {
                  lat: lat.toFixed(8),
                  lon: lon.toFixed(8),
                  dmsLat: toDMS(lat, true),
                  dmsLon: toDMS(lon, false),
                  utmE: easting.toFixed(2),
                  utmN: northing.toFixed(2),
                },
              });
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        // ═══════════════════════════════════════════
        // EDICAO
        // ═══════════════════════════════════════════
        case 'buffer': {
          onToolInfo?.(`Clique em um poligono para criar buffer de ${bufferDistance}m`);
          const toolLayer = getOrCreateToolLayer(view, 'tool-buffer-layer');

          const handler = view.on('click', async (e) => {
            const hitResult = await view.hitTest(e);
            const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');
            if (graphicHit && graphicHit.type === 'graphic') {
              const geom = graphicHit.graphic.geometry as __esri.Polygon;
              const buffer = geometryEngine.geodesicBuffer(geom, bufferDistance, 'meters');
              if (buffer && !Array.isArray(buffer)) {
                renderBuffer(toolLayer, buffer as __esri.Polygon);
                const bufferArea = Math.abs(geometryEngine.geodesicArea(buffer as __esri.Polygon, 'square-meters'));
                onToolResult({
                  type: 'buffer',
                  value: bufferArea,
                  unit: 'm2',
                  details: { distancia: `${bufferDistance}m`, area: bufferArea.toFixed(2) },
                });
              }
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        case 'dividir': {
          onToolInfo?.('Clique em 2 pontos para criar a linha de corte');
          const toolLayer = getOrCreateToolLayer(view, 'tool-split-layer');

          const handler = view.on('click', async (e) => {
            const geo = webMercatorUtils.webMercatorToGeographic(e.mapPoint) as __esri.Point;
            const coords: [number, number] = [geo.longitude as number, geo.latitude as number];
            clickPointsRef.current.push(coords);

            renderMeasurementPoint(toolLayer, new Point({ longitude: coords[0], latitude: coords[1] }), [255, 0, 0]);

            if (clickPointsRef.current.length >= 2) {
              const [p1, p2] = clickPointsRef.current;
              const splitLine = new Polyline({
                paths: [[p1, p2]],
                spatialReference: { wkid: 4326 },
              });

              renderMeasurementLine(toolLayer, splitLine, [255, 0, 0]);

              // Find target polygon via hitTest
              const hitResult = await view.hitTest(e);
              const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');

              if (graphicHit && graphicHit.type === 'graphic') {
                const targetPoly = graphicHit.graphic.geometry as __esri.Polygon;
                const geoTarget = webMercatorUtils.webMercatorToGeographic(targetPoly) as __esri.Polygon;
                const splitResult = geometryEngine.cut(geoTarget, splitLine);

                if (splitResult && splitResult.length === 2) {
                  renderSplitPolygons(toolLayer, splitResult[0] as __esri.Polygon, splitResult[1] as __esri.Polygon);
                  onToolResult({
                    type: 'dividir',
                    value: 'Poligono dividido com sucesso',
                    details: { partes: 2 },
                  });
                } else {
                  onToolError?.('Linha de corte nao intercepta o poligono');
                }
              } else {
                onToolError?.('Nenhum poligono encontrado no ponto clicado');
              }

              clickPointsRef.current = [];
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        case 'unir': {
          onToolInfo?.('Clique em 2 ou mais poligonos, depois pressione Enter para unir');
          const toolLayer = getOrCreateToolLayer(view, 'tool-union-layer');

          const handler = view.on('click', async (e) => {
            const hitResult = await view.hitTest(e);
            const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');
            if (graphicHit && graphicHit.type === 'graphic') {
              selectedGraphicsRef.current.push(graphicHit.graphic);
              renderGeometryResult(toolLayer, graphicHit.graphic.geometry as __esri.Geometry, [33, 150, 243]);
              onToolInfo?.(`${selectedGraphicsRef.current.length} poligono(s) selecionado(s). Clique mais ou pressione Enter para unir.`);
            }
          });
          handlersRef.current.push(handler);

          const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && selectedGraphicsRef.current.length >= 2) {
              const geometries = selectedGraphicsRef.current.map(g => g.geometry as __esri.Polygon);
              const geoGeometries = geometries.map(g => webMercatorUtils.webMercatorToGeographic(g) as __esri.Polygon);
              const united = geometryEngine.union(geoGeometries);

              if (united) {
                renderGeometryResult(toolLayer, united, [76, 175, 80]);
                const area = Math.abs(geometryEngine.geodesicArea(united as __esri.Polygon, 'square-meters'));
                onToolResult({
                  type: 'unir',
                  value: 'Poligonos unidos com sucesso',
                  details: { poligonos: selectedGraphicsRef.current.length, areaTotal: area.toFixed(2) },
                });
              }
              selectedGraphicsRef.current = [];
            }
          };
          window.addEventListener('keydown', keyHandler);
          // Store cleanup
          const originalCleanup = cleanup;
          handlersRef.current.push({ remove: () => window.removeEventListener('keydown', keyHandler) } as any);
          break;
        }

        case 'simplificar': {
          onToolInfo?.('Clique em um poligono para simplificar');
          const toolLayer = getOrCreateToolLayer(view, 'tool-general-layer');

          const handler = view.on('click', async (e) => {
            const hitResult = await view.hitTest(e);
            const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');
            if (graphicHit && graphicHit.type === 'graphic') {
              const geom = graphicHit.graphic.geometry as __esri.Polygon;
              const geoGeom = webMercatorUtils.webMercatorToGeographic(geom) as __esri.Polygon;
              const verticesBefore = geoGeom.rings[0]?.length || 0;

              const simplified = geometryEngine.simplify(geoGeom);
              if (simplified) {
                const simplifiedPoly = simplified as __esri.Polygon;
                const verticesAfter = simplifiedPoly.rings[0]?.length || 0;
                renderGeometryResult(toolLayer, simplifiedPoly, [0, 188, 212]);
                onToolResult({
                  type: 'simplificar',
                  value: `Simplificado: ${verticesBefore} → ${verticesAfter} vertices`,
                  details: { antes: verticesBefore, depois: verticesAfter },
                });
              }
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        // ═══════════════════════════════════════════
        // TOPOLOGIA
        // ═══════════════════════════════════════════
        case 'validar-topologia': {
          onToolInfo?.('Clique em um poligono para validar topologia');
          const toolLayer = getOrCreateToolLayer(view, 'tool-topology-layer');

          const handler = view.on('click', async (e) => {
            const hitResult = await view.hitTest(e);
            const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');
            if (graphicHit && graphicHit.type === 'graphic') {
              const geom = graphicHit.graphic.geometry as __esri.Polygon;
              const result = validatePolygonTopology(geom);

              if (result.valid) {
                renderGeometryResult(toolLayer, geom, [76, 175, 80]);
              } else {
                renderGeometryResult(toolLayer, geom, [244, 67, 54]);
              }

              onToolResult({
                type: 'validar-topologia',
                value: result.valid ? 'Topologia valida' : `${result.errors.length} erro(s) encontrado(s)`,
                details: {
                  valido: result.valid,
                  erros: result.errors.map(err => `[${err.severity}] ${err.message}`),
                },
              });
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        case 'fechar-gaps': {
          onToolInfo?.('Analisando gaps entre todos os poligonos visiveis...');
          import('../lib/geometry/GeometryUtils').then(({ findAllPolygons }) => {
            const polygons = findAllPolygons(view);
            if (polygons.length < 2) {
              onToolError?.('Necessario pelo menos 2 poligonos para detectar gaps');
              return;
            }

            const gaps = detectGaps(polygons);
            const toolLayer = getOrCreateToolLayer(view, 'tool-topology-layer');

            if (gaps.length === 0) {
              onToolResult({
                type: 'fechar-gaps',
                value: 'Nenhum gap detectado',
                details: { totalPoligonos: polygons.length },
              });
            } else {
              onToolResult({
                type: 'fechar-gaps',
                value: `${gaps.length} gap(s) detectado(s)`,
                details: {
                  totalPoligonos: polygons.length,
                  gaps: gaps.map(g => g.message),
                },
              });
            }
          });
          break;
        }

        case 'simplificar-topologia': {
          onToolInfo?.('Validando topologia de todos os poligonos...');
          import('../lib/geometry/GeometryUtils').then(({ findAllPolygons }) => {
            const polygons = findAllPolygons(view);
            if (polygons.length === 0) {
              onToolError?.('Nenhum poligono encontrado');
              return;
            }

            const result = validateMultiPolygonTopology(polygons);
            onToolResult({
              type: 'simplificar-topologia',
              value: result.valid ? 'Topologia geral valida' : `${result.errors.length} problema(s)`,
              details: {
                valido: result.valid,
                totalPoligonos: polygons.length,
                erros: result.errors.map(err => `[${err.severity}] ${err.message}`),
              },
            });
          });
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
                  type: activeTool,
                  value: `Arquivo "${file.name}" importado com sucesso`,
                  geometry: geojson,
                  details: { fileName: file.name, type: geojson.type },
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
          const handler = view.on('click', async (e) => {
            const hitResult = await view.hitTest(e);
            const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');
            if (graphicHit && graphicHit.type === 'graphic') {
              const geom = graphicHit.graphic.geometry as __esri.Polygon;
              const geoGeom = webMercatorUtils.webMercatorToGeographic(geom) as __esri.Polygon;

              const geojson = {
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: geoGeom.rings,
                },
                properties: graphicHit.graphic.attributes || {},
              };

              const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'export.geojson';
              a.click();
              URL.revokeObjectURL(url);

              onToolResult({
                type: 'exportar-geojson',
                value: 'GeoJSON exportado com sucesso',
              });
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        case 'exportar-dxf': {
          onToolInfo?.('Exportacao DXF requer backend. Clique em um poligono para exportar.');
          const handler = view.on('click', async (e) => {
            const hitResult = await view.hitTest(e);
            const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');
            if (graphicHit && graphicHit.type === 'graphic') {
              onToolError?.('Exportacao DXF: backend nao configurado ainda');
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        // ═══════════════════════════════════════════
        // SIGEF + COORDENADAS
        // ═══════════════════════════════════════════
        case 'sigef-validar': {
          onToolInfo?.('Clique em um poligono para validar contra regras SIGEF');
          const handler = view.on('click', async (e) => {
            const hitResult = await view.hitTest(e);
            const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');
            if (graphicHit && graphicHit.type === 'graphic') {
              const geom = graphicHit.graphic.geometry as __esri.Polygon;
              const area = Math.abs(geometryEngine.geodesicArea(geom, 'square-meters'));
              const areaHa = area / 10000;
              const vertexCount = geom.rings[0]?.length || 0;

              const erros: string[] = [];
              const avisos: string[] = [];

              if (vertexCount < 4) erros.push('Minimo 3 vertices unicos necessarios');
              if (area < 1) erros.push('Area minima nao atingida');
              if (!geometryEngine.isSimple(geom)) erros.push('Geometria possui auto-interseccao');
              if (areaHa > 100000) avisos.push('Area muito grande - verificar precisao');

              onToolResult({
                type: 'sigef-validar',
                value: erros.length === 0 ? 'Geometria compativel com SIGEF' : `${erros.length} erro(s) SIGEF`,
                details: { valido: erros.length === 0, erros, avisos, areaHa: areaHa.toFixed(4), vertices: vertexCount },
              });
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        case 'sigef-memorial': {
          onToolInfo?.('Clique em um poligono para gerar memorial descritivo');
          const handler = view.on('click', async (e) => {
            const hitResult = await view.hitTest(e);
            const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');
            if (graphicHit && graphicHit.type === 'graphic') {
              const geom = graphicHit.graphic.geometry as __esri.Polygon;
              const geoGeom = webMercatorUtils.webMercatorToGeographic(geom) as __esri.Polygon;
              const ring = geoGeom.rings[0] || [];
              const area = Math.abs(geometryEngine.geodesicArea(geom, 'square-meters'));

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
                type: 'sigef-memorial',
                value: 'Memorial gerado com sucesso',
                details: { memorial, area: area.toFixed(2), vertices: ring.length - 1 },
              });
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        case 'sigef-vertices': {
          onToolInfo?.('Clique em um poligono para extrair vertices SIRGAS');
          const handler = view.on('click', async (e) => {
            const hitResult = await view.hitTest(e);
            const graphicHit = hitResult.results.find(r => r.type === 'graphic' && r.graphic?.geometry?.type === 'polygon');
            if (graphicHit && graphicHit.type === 'graphic') {
              const geom = graphicHit.graphic.geometry as __esri.Polygon;
              const geoGeom = webMercatorUtils.webMercatorToGeographic(geom) as __esri.Polygon;
              const ring = geoGeom.rings[0] || [];

              const vertices = ring.slice(0, -1).map((coord, i) => {
                const [lon, lat] = coord;
                const [utmE, utmN] = geographicToSIRGASUTM(lon, lat);
                return {
                  id: `V${i + 1}`,
                  lon: lon.toFixed(8),
                  lat: lat.toFixed(8),
                  utmE: utmE.toFixed(2),
                  utmN: utmN.toFixed(2),
                  dmsLon: toDMS(lon, false),
                  dmsLat: toDMS(lat, true),
                };
              });

              onToolResult({
                type: 'sigef-vertices',
                value: `${vertices.length} vertices extraidos`,
                details: { vertices, totalVertices: vertices.length },
              });
            }
          });
          handlersRef.current.push(handler);
          break;
        }

        case 'converter-coords':
        case 'adicionar-ponto': {
          // These are handled by modals in the panel, not map clicks
          onToolInfo?.('Use o formulario no painel lateral');
          break;
        }

        default:
          break;
      }
    });

    return cleanup;
  }, [view, activeTool, bufferDistance, cleanup, onToolResult, onToolError, onToolInfo]);
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
