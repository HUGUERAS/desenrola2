/**
 * MapContainer — Mapa MapLibre GL JS
 * Substitui ArcGIS Maps SDK por MapLibre + MapboxGLDraw + Turf.js
 * Mantém a mesma interface de props e comportamento visual.
 */
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import type { Polygon, Feature, FeatureCollection } from 'geojson';
import { bbox } from '@turf/turf';
import { useApp } from '../../pages/AppShell';
import { wktToRings, calculateCentroid, geoJSONToRings, ringsToGeoJSON } from '../../lib/geo-utils';
import { useToolExecution } from '../../hooks/useToolExecution';
import { registerSourceData } from '../../lib/geometry/GeometryUtils';

/* ── Tipos ── */
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
    zoomTo?: Record<string, any> | null;
}

/* ── Cores por tipo (fill, line) ── */
const TYPE_COLORS: Record<string, { fill: string; line: string; opacity: number }> = {
    rascunho: { fill: '#ffc107', line: '#ffc107', opacity: 0.2 },
    oficial: { fill: '#10b981', line: '#10b981', opacity: 0.25 },
    sobreposicao: { fill: '#ef4444', line: '#ef4444', opacity: 0.35 },
    vizinho: { fill: '#94a3b8', line: '#94a3b8', opacity: 0.15 },
    ativo: { fill: '#3b82f6', line: '#3b82f6', opacity: 0.3 },
};

/* ── Fix: MapboxDraw + MapLibre dasharray compatibility ── */
// MapboxDraw usa arrays diretos ([0.2, 2]) dentro de expressões `case`.
// MapLibre exige ["literal", [0.2, 2]]. Percorre recursivamente a expressão e wrapa.
function fixDasharray(expr: unknown): unknown {
    if (Array.isArray(expr)) {
        // É um array de números direto (ex: [0.2, 2]) — wrapa com literal
        if (expr.length > 0 && typeof expr[0] === 'number') {
            return ['literal', expr];
        }
        // É uma expressão MapLibre ([operator, ...args]) — percorre recursivamente
        return expr.map(fixDasharray);
    }
    return expr;
}

export default function MapContainer({
    lotes = [],
    drawingEnabled = false,
    onGeometryChange,
    onLoteClick,
    zoomTo,
}: MapContainerProps) {
    const { setCursorCoords, activeTool, setToolResult, sketchTool, setSketchTool, loteAtual } = useApp();
    const mapDivRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const drawRef = useRef<InstanceType<typeof MapboxDraw> | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [basemap, setBasemap] = useState<'osm' | 'satellite'>('osm');

    const toggleBasemap = () => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;
        const next = basemap === 'osm' ? 'satellite' : 'osm';
        const tileUrl = next === 'satellite'
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        (map.getSource('osm') as maplibregl.RasterTileSource)?.setTiles([tileUrl]);
        setBasemap(next);
    };

    const onLoteClickRef = useRef(onLoteClick);
    onLoteClickRef.current = onLoteClick;
    const setCursorCoordsRef = useRef(setCursorCoords);
    setCursorCoordsRef.current = setCursorCoords;
    const onGeometryChangeRef = useRef(onGeometryChange);
    onGeometryChangeRef.current = onGeometryChange;

    /* ── Inicializa mapa uma vez ── */
    useEffect(() => {
        if (!mapDivRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapDivRef.current,
            style: {
                version: 8,
                glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
                sources: {
                    osm: {
                        type: 'raster',
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        maxzoom: 19,
                        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                    },
                },
                layers: [{ id: 'osm-layer', type: 'raster', source: 'osm' }],
            },
            center: [-47.93, -15.78],
            zoom: 13,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-left');

        // Fix de compatibilidade: MapboxDraw usa line-dasharray com data expressions
        // (case/match) que MapLibre não suporta. Substituímos por valor estático.
        const origAddLayer = map.addLayer.bind(map);
        (map as any).addLayer = (layer: any, before?: string) => {
            if (layer?.paint?.['line-dasharray']) {
                const dash = layer.paint['line-dasharray'];
                // Se for uma expressão (array com string no inicio como 'case','match'),
                // substitui por valor estático simples
                if (Array.isArray(dash) && typeof dash[0] === 'string' && dash[0] !== 'literal') {
                    layer = {
                        ...layer,
                        paint: {
                            ...layer.paint,
                            'line-dasharray': ['literal', [2, 1]],
                        },
                    };
                } else {
                    layer = {
                        ...layer,
                        paint: {
                            ...layer.paint,
                            'line-dasharray': fixDasharray(dash),
                        },
                    };
                }
            }
            return origAddLayer(layer, before);
        };

        map.on('load', () => {
            // Fonte de lotes (preenchida depois)
            map.addSource('lotes-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] } as FeatureCollection,
            });

            // Camada fill dos lotes
            map.addLayer({
                id: 'lotes-fill',
                type: 'fill',
                source: 'lotes-source',
                paint: {
                    'fill-color': [
                        'match', ['get', 'loteType'],
                        'rascunho', '#ffc107',
                        'oficial', '#10b981',
                        'sobreposicao', '#ef4444',
                        'vizinho', '#94a3b8',
                        '#3b82f6',
                    ],
                    'fill-opacity': [
                        'match', ['get', 'loteType'],
                        'rascunho', 0.2,
                        'sobreposicao', 0.35,
                        'vizinho', 0.15,
                        0.3,
                    ],
                },
            });

            // Camada de borda dos lotes
            map.addLayer({
                id: 'lotes-line',
                type: 'line',
                source: 'lotes-source',
                paint: {
                    'line-color': [
                        'match', ['get', 'loteType'],
                        'rascunho', '#ffc107',
                        'oficial', '#10b981',
                        'sobreposicao', '#ef4444',
                        'vizinho', '#94a3b8',
                        '#3b82f6',
                    ],
                    'line-width': ['match', ['get', 'loteType'], 'sobreposicao', 3, 2],
                },
            });

            // Camada de labels dos lotes
            map.addLayer({
                id: 'lotes-label',
                type: 'symbol',
                source: 'lotes-source',
                layout: {
                    'text-field': ['get', 'label'],
                    'text-size': 11,
                    'text-font': ['Open Sans Bold'],
                    'text-anchor': 'center',
                },
                paint: {
                    'text-color': '#e2e8f0',
                    'text-halo-color': '#0f172a',
                    'text-halo-width': 1.5,
                },
            });

            // Camada de highlight do lote selecionado
            map.addSource('lote-highlight-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] } as FeatureCollection,
            });
            map.addLayer({
                id: 'lote-highlight-line',
                type: 'line',
                source: 'lote-highlight-source',
                paint: {
                    'line-color': '#facc15',
                    'line-width': 3,
                    'line-dasharray': ['literal', [2, 1]],
                },
            });
            map.addLayer({
                id: 'lote-highlight-fill',
                type: 'fill',
                source: 'lote-highlight-source',
                paint: {
                    'fill-color': '#facc15',
                    'fill-opacity': 0.15,
                },
            });

            mapRef.current = map;
            setMapLoaded(true);
        });

        // Coordenadas do cursor
        map.on('mousemove', (e) => {
            setCursorCoordsRef.current?.({ lat: e.lngLat.lat, lon: e.lngLat.lng });
        });

        // Clique em lote
        map.on('click', 'lotes-fill', (e) => {
            const feature = e.features?.[0];
            if (feature?.properties?.loteId) {
                onLoteClickRef.current?.(feature.properties.loteId);
            }
        });

        // Cursor pointer sobre lotes
        map.on('mouseenter', 'lotes-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'lotes-fill', () => { map.getCanvas().style.cursor = ''; });

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                setMapLoaded(false);
            }
        };
    }, []);

    /* ── Atualiza lotes no mapa ── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        const features: Feature[] = [];

        lotes.forEach((lote) => {
            let rings: number[][][] | null = null;

            if (lote.geojson) {
                rings = geoJSONToRings(lote.geojson);
            } else if (lote.wkt) {
                rings = wktToRings(lote.wkt);
            }

            if (!rings) return;

            const geometry: Polygon = { type: 'Polygon', coordinates: rings };
            features.push({
                type: 'Feature',
                geometry,
                properties: { loteId: lote.id, loteType: lote.type, label: lote.label || '' },
            });
        });

        const fc: FeatureCollection = { type: 'FeatureCollection', features };
        const src = map.getSource('lotes-source') as maplibregl.GeoJSONSource | undefined;
        if (src) {
            src.setData(fc);
            registerSourceData('lotes-source', fc);
        }
    }, [lotes, mapLoaded]);

    /* ── Highlight do lote selecionado ── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        const src = map.getSource('lote-highlight-source') as maplibregl.GeoJSONSource | undefined;
        if (!src) return;

        if (!loteAtual) {
            src.setData({ type: 'FeatureCollection', features: [] });
            return;
        }

        // Encontra o feature correspondente ao loteAtual
        const match = lotes.find(l => l.id === loteAtual.id);
        if (!match) {
            src.setData({ type: 'FeatureCollection', features: [] });
            return;
        }

        let rings: number[][][] | null = null;
        if (match.geojson) {
            rings = geoJSONToRings(match.geojson);
        } else if (match.wkt) {
            rings = wktToRings(match.wkt);
        }

        if (!rings) {
            src.setData({ type: 'FeatureCollection', features: [] });
            return;
        }

        const feature: Feature = {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: rings },
            properties: {},
        };
        src.setData({ type: 'FeatureCollection', features: [feature] });
    }, [loteAtual, lotes, mapLoaded]);

    /* ── Modo de desenho (MapboxDraw) ── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        if (drawingEnabled) {
            if (drawRef.current) return; // já existe

            // Fix de compatibilidade MapboxDraw + MapLibre:
            // O monkey-patch em addLayer já corrige automaticamente os dasharray.
            const draw = new MapboxDraw({
                displayControlsDefault: false,
                controls: {},
                defaultMode: 'simple_select',
            });

            // MapboxDraw.onAdd espera um mapa compatible; cast necessário por diferença de tipos
            map.addControl(draw as any, 'top-right');
            drawRef.current = draw;

            const onCreate = (e: { features: Feature[] }) => {
                const feature = e.features[0];
                if (feature?.geometry?.type === 'Polygon') {
                    const geojson = ringsToGeoJSON((feature.geometry as Polygon).coordinates[0]);
                    onGeometryChangeRef.current?.(geojson);
                    // Após criar: vai para simple_select para que o usuário possa mover/apagar
                    try { draw.changeMode('simple_select', { featureIds: [feature.id as string] }); } catch { }
                }
            };
            const onUpdate = (e: { features: Feature[] }) => {
                const feature = e.features[0];
                if (feature?.geometry?.type === 'Polygon') {
                    const geojson = ringsToGeoJSON((feature.geometry as Polygon).coordinates[0]);
                    onGeometryChangeRef.current?.(geojson);
                }
            };
            const onDelete = () => {
                // Notifica o pai que a geometria foi removida; volta ao modo de desenho
                onGeometryChangeRef.current?.({});
                try { draw.changeMode('draw_polygon'); } catch { }
            };

            map.on('draw.create', onCreate);
            map.on('draw.update', onUpdate);
            map.on('draw.delete', onDelete);

            return () => {
                map.off('draw.create', onCreate);
                map.off('draw.update', onUpdate);
                map.off('draw.delete', onDelete);
                if (drawRef.current && map) {
                    map.removeControl(drawRef.current as any);
                    drawRef.current = null;
                }
            };
        } else {
            if (drawRef.current && map) {
                map.removeControl(drawRef.current as any);
                drawRef.current = null;
            }
        }
    }, [drawingEnabled, mapLoaded]);

    /* ── Activate sketch tool from context (DesenharPanel buttons) ── */
    useEffect(() => {
        if (!sketchTool || !drawRef.current) return;
        if (sketchTool === 'clear') {
            try {
                drawRef.current.deleteAll();
                onGeometryChangeRef.current?.({});
                drawRef.current.changeMode('draw_polygon' as any);
            } catch { }
            setSketchTool(null);
            return;
        }
        const mode = 'draw_polygon';
        try { drawRef.current.changeMode(mode as any); } catch { }
        setSketchTool(null);
    }, [sketchTool, setSketchTool]);

    /* ── Zoom para geometria importada ── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded || !zoomTo || !Object.keys(zoomTo).length) return;
        try {
            const [minLng, minLat, maxLng, maxLat] = bbox(zoomTo as any);
            map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, maxZoom: 18, duration: 800 });
        } catch { }
    }, [zoomTo, mapLoaded]);

    /* ── CAD Tool Execution ── */
    useToolExecution({
        map: mapRef.current,
        activeTool,
        onToolResult: setToolResult,
    });

    return (
        <div className="map-container">
            <div ref={mapDivRef} className="map-view" />

            <div className="map-basemap-toggle" onClick={toggleBasemap} title={basemap === 'osm' ? 'Mudar para Satélite' : 'Mudar para Mapa'}>
                {basemap === 'osm' ? '🛰️ Satélite' : '🗺️ Mapa'}
            </div>

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

            {drawingEnabled && (
                <div className="map-draw-hint">
                    ✏️ Clique para desenhar · Duplo-clique para fechar o polígono
                </div>
            )}
        </div>
    );
}