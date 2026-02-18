/**
 * MapContainer — Mapa ArcGIS unificado para o SPA
 * Combina: visualização de lotes + desenho (Sketch) + coordenadas do cursor
 *
 * Usa SRID 4674 (SIRGAS 2000) — visualmente idêntico a 4326.
 * O ArcGIS exibe nativamente em Web Mercator; convertemos para geográfico ao exportar WKT.
 */
import { useEffect, useRef, useCallback } from 'react';
import MapView from '@arcgis/core/views/MapView';
import ArcGISMap from '@arcgis/core/Map';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Polygon from '@arcgis/core/geometry/Polygon';
import Sketch from '@arcgis/core/widgets/Sketch';
import BasemapToggle from '@arcgis/core/widgets/BasemapToggle';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';
import Point from '@arcgis/core/geometry/Point';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
import esriConfig from '@arcgis/core/config';
import '@arcgis/core/assets/esri/themes/dark/main.css';

import { useApp } from '../../pages/AppShell';
import { wktToRings, ringsToWkt, calculateCentroid } from '../../lib/geo-utils';

/* ── Tipos de camada ── */
export interface LoteGeometry {
    id: number;
    wkt?: string;
    label?: string;
    type: 'rascunho' | 'oficial' | 'sobreposicao' | 'vizinho' | 'ativo';
}

interface MapContainerProps {
    lotes?: LoteGeometry[];
    drawingEnabled?: boolean;
    onGeometryChange?: (wkt: string) => void;
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
    const { setCursorCoords } = useApp();
    const mapDivRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const sketchRef = useRef<Sketch | null>(null);
    const lotesLayerRef = useRef<GraphicsLayer | null>(null);
    const drawLayerRef = useRef<GraphicsLayer | null>(null);

    // Inicializa mapa uma vez
    useEffect(() => {
        if (!mapDivRef.current) return;

        const apiKey = import.meta.env.VITE_ESRI_API_KEY;
        if (apiKey) esriConfig.apiKey = apiKey;

        const lotesLayer = new GraphicsLayer({ title: 'Lotes' });
        const drawLayer = new GraphicsLayer({ title: 'Desenho' });
        lotesLayerRef.current = lotesLayer;
        drawLayerRef.current = drawLayer;

        // Camada base (OSM - Público, não requer Key para visualização básica)
        const map = new ArcGISMap({
            basemap: 'osm',
            layers: [lotesLayer, drawLayer],
        });

        const view = new MapView({
            container: mapDivRef.current,
            map,
            center: [-47.93, -15.78], // Brasília (default)
            zoom: 13,
            ui: { components: ['zoom', 'compass'] },
        });

        view.when(
            () => { viewRef.current = view; },
            (err: any) => { console.error('Erro ao carregar o View do ArcGIS:', err); }
        );

        // Widget de troca de basemap
        // const bmToggle = new BasemapToggle({ view, nextBasemap: 'satellite' });
        // view.ui.add(bmToggle, 'bottom-right');

        // Escala
        // const scaleBar = new ScaleBar({ view, unit: 'metric', style: 'ruler' });
        // view.ui.add(scaleBar, 'bottom-left');

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
            view.destroy();
            viewRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Atualizar lotes no mapa
    useEffect(() => {
        const layer = lotesLayerRef.current;
        const view = viewRef.current;
        if (!layer || !view) return;

        layer.removeAll();

        lotes.forEach((lote) => {
            const rings = wktToRings(lote.wkt || '');
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

        // Zoom para mostrar todos os lotes
        if (lotes.length > 0) {
            view.when(() => {
                const extent = layer.fullExtent;
                if (extent && extent.width > 0) {
                    view.goTo(extent.expand(1.3));
                }
            });
        }
    }, [lotes]);

    // Ativar/desativar Sketch
    const handleGeomChange = useCallback(
        (wkt: string) => {
            onGeometryChange?.(wkt);
        },
        [onGeometryChange]
    );

    useEffect(() => {
        const view = viewRef.current;
        const drawLayer = drawLayerRef.current;
        if (!view || !drawLayer) return;

        if (drawingEnabled) {
            view.when(() => {
                // Cria o Sketch apenas quando a view estiver pronta
                const sketch = new Sketch({
                    view,
                    layer: drawLayer,
                    creationMode: 'continuous',
                    availableCreateTools: ['polygon'],
                    defaultCreateOptions: { mode: 'click' },
                    visibleElements: {
                        duplicateButton: false,
                        settingsMenu: false,
                    },
                });

                view.ui.add(sketch, 'top-right');
                sketchRef.current = sketch;

                sketch.on('create', (event) => {
                    if (event.state === 'complete' && event.graphic?.geometry?.type === 'polygon') {
                        const geo = webMercatorUtils.webMercatorToGeographic(
                            event.graphic.geometry
                        ) as __esri.Polygon;
                        if (geo.rings && geo.rings.length > 0) {
                            const wkt = ringsToWkt(geo.rings[0]);
                            handleGeomChange(wkt);
                        }
                    }
                });

                sketch.on('update', (event) => {
                    if (event.state === 'complete' && event.graphics?.[0]?.geometry?.type === 'polygon') {
                        const geo = webMercatorUtils.webMercatorToGeographic(
                            event.graphics[0].geometry
                        ) as __esri.Polygon;
                        if (geo.rings && geo.rings.length > 0) {
                            const wkt = ringsToWkt(geo.rings[0]);
                            handleGeomChange(wkt);
                        }
                    }
                });
            }, (err: any) => {
                console.error('Erro no Sketch:', err);
            });
        } else {
            // Remove Sketch
            if (sketchRef.current) {
                view.ui.remove(sketchRef.current);
                sketchRef.current.destroy();
                sketchRef.current = null;
            }
        }

        return () => {
            if (sketchRef.current) {
                view.ui.remove(sketchRef.current);
                sketchRef.current.destroy();
                sketchRef.current = null;
            }
        };
    }, [drawingEnabled, handleGeomChange]);

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
