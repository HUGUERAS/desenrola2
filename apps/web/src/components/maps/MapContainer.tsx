/**
 * MapContainer — Mapa ArcGIS unificado para o SPA
 * Combina: visualização de lotes + desenho (Sketch) + coordenadas do cursor
 *
 * Usa SRID 4674 (SIRGAS 2000) — visualmente idêntico a 4326.
 * O ArcGIS exibe nativamente em Web Mercator; convertemos para geográfico ao exportar GeoJSON.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import MapView from '@arcgis/core/views/MapView';
import ArcGISMap from '@arcgis/core/Map';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Polygon from '@arcgis/core/geometry/Polygon';
import Sketch from '@arcgis/core/widgets/Sketch';

import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';
import Point from '@arcgis/core/geometry/Point';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
import esriConfig from '@arcgis/core/config';
import LayerList from "@arcgis/core/widgets/LayerList";
import Expand from "@arcgis/core/widgets/Expand";
import * as intl from "@arcgis/core/intl";
import '@arcgis/core/assets/esri/themes/dark/main.css';

import { useApp } from '../../pages/AppShell';
import { wktToRings, calculateCentroid, geoJSONToRings, ringsToGeoJSON } from '../../lib/geo-utils';
import { useToolExecution } from '../../hooks/useToolExecution';

/* ── Tipos de camada ── */
export interface LoteGeometry {
    id: number;
    wkt?: string;
    geojson?: Record<string, any>;
    label?: string;
    type: 'rascunho' | 'oficial' | 'sobreposicao' | 'vizinho' | 'ativo';
}

interface MapContainerProps {
    lotes?: LoteGeometry[];
    drawingEnabled?: boolean;
    onGeometryChange?: (geojson: Record<string, any>) => void;
    onLoteClick?: (loteId: number) => void;
}

/* ── Símbolos por tipo ── */
const SYMBOLS: Record<string, () => SimpleFillSymbol> = {
    rascunho: () =>
        new SimpleFillSymbol({
            color: [255, 193, 7, 0.2],
            outline: new SimpleLineSymbol({ color: [255, 193, 7], width: 2, style: 'dash' }),
        }),
    oficial: () =>
        new SimpleFillSymbol({
            color: [16, 185, 129, 0.25],
            outline: new SimpleLineSymbol({ color: [16, 185, 129], width: 2, style: 'solid' }),
        }),
    sobreposicao: () =>
        new SimpleFillSymbol({
            color: [239, 68, 68, 0.35],
            outline: new SimpleLineSymbol({ color: [239, 68, 68], width: 3, style: 'solid' }),
        }),
    vizinho: () =>
        new SimpleFillSymbol({
            color: [148, 163, 184, 0.15],
            outline: new SimpleLineSymbol({ color: [148, 163, 184], width: 1, style: 'dot' }),
        }),
    ativo: () =>
        new SimpleFillSymbol({
            color: [59, 130, 246, 0.3],
            outline: new SimpleLineSymbol({ color: [59, 130, 246], width: 3, style: 'solid' }),
        }),
};

export default function MapContainer({
    lotes = [],
    drawingEnabled = false,
    onGeometryChange,
    onLoteClick,
}: MapContainerProps) {
    const { setCursorCoords, activeTool, setToolResult, toolLayers } = useApp();
    const mapDivRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false); // Só para avisar outros effects
    const sketchRef = useRef<Sketch | null>(null);
    const lotesLayerRef = useRef<GraphicsLayer | null>(null);
    const drawLayerRef = useRef<GraphicsLayer | null>(null);
    const layerListExpandRef = useRef<InstanceType<typeof Expand> | null>(null);

    // Guardar callbacks em refs para evitar recriar o mapa se elas mudarem
    const onLoteClickRef = useRef(onLoteClick);
    onLoteClickRef.current = onLoteClick;
    const setCursorCoordsRef = useRef(setCursorCoords);
    setCursorCoordsRef.current = setCursorCoords;

    const drawingEnabledRef = useRef(drawingEnabled);
    drawingEnabledRef.current = drawingEnabled;

    // Inicializa mapa uma vez
    useEffect(() => {
        if (!mapDivRef.current || viewRef.current) return;

        console.log('[DEBUG] Montando instância do ArcGIS...');

        esriConfig.assetsPath = '/assets/esri';
        intl.setLocale("pt-BR");

        const apiKey = import.meta.env.VITE_ESRI_API_KEY;
        if (apiKey) esriConfig.apiKey = apiKey;

        const lotsL = new GraphicsLayer({ title: 'Lotes' });
        const drawL = new GraphicsLayer({ title: 'Desenho' });
        lotesLayerRef.current = lotsL;
        drawLayerRef.current = drawL;

        const map = new ArcGISMap({
            basemap: apiKey ? 'satellite' : 'osm',
            layers: [lotsL, drawL],
        });

        const view = new MapView({
            container: mapDivRef.current,
            map,
            center: [-47.93, -15.78],
            zoom: 13,
            ui: { components: ['zoom'] },
        });

        view.when(
            () => {
                viewRef.current = view;
                setMapLoaded(true);
                console.log('[DEBUG] ArcGIS View pronto.');
            },
            (err: any) => console.error('[CRITICAL] Erro ArcGIS:', err)
        );


        // Rastrear coordenadas do cursor
        view.on('pointer-move', (evt) => {
            const pt = view.toMap(evt);
            if (pt) {
                // Converter Web Mercator → geográfico
                const geo = webMercatorUtils.webMercatorToGeographic(pt) as __esri.Point;
                setCursorCoords({ lat: geo.latitude ?? 0, lon: geo.longitude ?? 0 });
            }
        });

        // Clique em lote
        view.on('click', (evt) => {
            view.hitTest(evt).then((response) => {
                const hit = response.results.find(
                    (r) => r.type === 'graphic' && r.graphic?.attributes?.loteId
                );
                if (hit && hit.type === 'graphic' && onLoteClick) {
                    onLoteClick(hit.graphic.attributes.loteId);
                }
            });
        });

        return () => {
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
                setMapLoaded(false);
            }
        };
    }, []);

    useEffect(() => {
        const layer = lotesLayerRef.current;
        const view = viewRef.current;
        if (!layer || !view) return;

        layer.removeAll();

        lotes.forEach((lote) => {
            let rings: number[][][] | null = null;

            if (lote.geojson) {
                rings = geoJSONToRings(lote.geojson);
            } else if (lote.wkt) {
                rings = wktToRings(lote.wkt);
            }

            if (!rings) return;

            const polygon = new Polygon({
                rings,
                spatialReference: { wkid: 4326 },
            });

            const symbolFn = SYMBOLS[lote.type] || SYMBOLS.oficial;
            const graphic = new Graphic({
                geometry: polygon,
                symbol: symbolFn(),
                attributes: { loteId: lote.id, label: lote.label },
            });

            layer.add(graphic);

            // Label
            if (lote.label) {
                const centroid = calculateCentroid(rings[0]);
                const labelGraphic = new Graphic({
                    geometry: new Point({ longitude: centroid[0], latitude: centroid[1] }),
                    symbol: new TextSymbol({
                        text: lote.label,
                        color: '#e2e8f0',
                        haloColor: '#0f172a',
                        haloSize: 1.5,
                        font: { size: 11, weight: 'bold' },
                    }),
                    attributes: { loteId: lote.id },
                });
                layer.add(labelGraphic);
            }
        });
    }, [lotes, mapLoaded, drawingEnabled]);

    // Ativar/desativar Sketch
    const handleGeomChange = useCallback(
        (geojson: Record<string, any>) => {
            onGeometryChange?.(geojson);
        },
        [onGeometryChange]
    );

    useEffect(() => {
        const view = viewRef.current;
        const drawLayer = drawLayerRef.current;

        console.log('[DEBUG] Effect Drawing:', {
            drawingEnabled,
            hasView: !!view,
            hasLayer: !!drawLayer
        });

        if (!view || !drawLayer) return;

        if (drawingEnabled) {
            console.warn('[DEBUG] Ativando Sketch no Mapa');
            view.when(() => {
                // Evitar race: se já desativamos desenho, não adicionar widgets
                if (!drawingEnabledRef.current) return;

                // Layer List (Gerenciador de Camadas)
                const layerList = new LayerList({
                    view: view,
                    listItemCreatedFunction: (event) => {
                        const item = event.item;
                        if (item.layer && item.layer.type !== "group") {
                            item.panel = {
                                content: "legend",
                                open: false
                            } as any;
                        }
                    }
                });

                const layerListExpand = new Expand({
                    view: view,
                    content: layerList,
                    group: "top-left",
                    icon: "layers",
                    expandTooltip: "Camadas",
                    expanded: false
                });

                view.ui.add(layerListExpand, "top-left");
                layerListExpandRef.current = layerListExpand;

                // Cria o Sketch quando a view estiver pronta
                console.log('[DEBUG] Instanciando Sketch widget...');
                const sketch = new Sketch({
                    view,
                    layer: drawLayer,
                    creationMode: 'continuous',
                    availableCreateTools: ['polygon', 'rectangle', 'circle'],
                    defaultCreateOptions: { mode: 'click' },
                    visibleElements: {
                        duplicateButton: false,
                        settingsMenu: true,
                        selectionTools: {
                            "lasso-selection": true,
                            "rectangle-selection": true,
                        },
                    },
                });

                console.warn('[DEBUG] Adicionando Sketch no UI top-right');
                view.ui.add(sketch, 'top-right');
                sketchRef.current = sketch;

                sketch.on('create', (event) => {
                    if (event.state === 'complete' && event.graphic?.geometry?.type === 'polygon') {
                        const geo = webMercatorUtils.webMercatorToGeographic(
                            event.graphic.geometry
                        ) as __esri.Polygon;
                        if (geo.rings && geo.rings.length > 0) {
                            const geojson = ringsToGeoJSON(geo.rings[0]);
                            handleGeomChange(geojson);
                        }
                    }
                });

                sketch.on('update', (event) => {
                    if (event.state === 'complete' && event.graphics?.[0]?.geometry?.type === 'polygon') {
                        const geo = webMercatorUtils.webMercatorToGeographic(
                            event.graphics[0].geometry
                        ) as __esri.Polygon;
                        if (geo.rings && geo.rings.length > 0) {
                            const geojson = ringsToGeoJSON(geo.rings[0]);
                            handleGeomChange(geojson);
                        }
                    }
                });
            }, (err: any) => {
                console.error('Erro no Sketch:', err);
            });
        } else {
            // Remove LayerList e Sketch ao sair do modo desenho
            if (layerListExpandRef.current) {
                view.ui.remove(layerListExpandRef.current);
                layerListExpandRef.current.destroy();
                layerListExpandRef.current = null;
            }
            if (sketchRef.current) {
                view.ui.remove(sketchRef.current);
                sketchRef.current.destroy();
                sketchRef.current = null;
            }
        }

        return () => {
            if (layerListExpandRef.current && view?.ui) {
                view.ui.remove(layerListExpandRef.current);
                layerListExpandRef.current.destroy();
                layerListExpandRef.current = null;
            }
            if (sketchRef.current && view?.ui) {
                view.ui.remove(sketchRef.current);
                sketchRef.current.destroy();
                sketchRef.current = null;
            }
        };
    }, [drawingEnabled, handleGeomChange, mapLoaded]);

    // ── CAD Tool Execution ──
    useToolExecution({
        view: viewRef.current,
        activeTool,
        onToolResult: setToolResult,
    });

    // ── Sync toolLayers visibility/opacity with map layers ──
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;

        toolLayers.forEach(config => {
            const layer = view.map.findLayerById(config.id);
            if (layer) {
                layer.visible = config.visible;
                layer.opacity = config.opacity / 100;
            }
        });
    }, [toolLayers, mapLoaded]);

    // ── Disable Sketch when CAD tool active ──
    useEffect(() => {
        const sketch = sketchRef.current;
        if (!sketch) return;

        if (activeTool) {
            sketch.cancel();
        }
    }, [activeTool]);

    return (
        <div className="map-container">
            <div ref={mapDivRef} className="map-view" />

            {/* Legenda flutuante */}
            {lotes.length > 0 && (
                <div className="map-legend">
                    <div className="map-legend-title">Legenda</div>
                    <div className="map-legend-item">
                        <span className="map-legend-swatch map-legend-swatch--ativo" />
                        Lote Ativo
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-swatch map-legend-swatch--oficial" />
                        Oficial
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-swatch map-legend-swatch--rascunho" />
                        Rascunho
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-swatch map-legend-swatch--vizinho" />
                        Vizinho
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-swatch map-legend-swatch--sobreposicao" />
                        Sobreposição
                    </div>
                </div>
            )}

            {drawingEnabled && (
                <div className="map-draw-hint">
                    ✏️ Clique no mapa para desenhar. Duplo-clique para fechar o polígono.
                </div>
            )}
        </div>
    );
}
