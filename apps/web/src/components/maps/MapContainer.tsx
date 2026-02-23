/**
 * MapContainer — Mapa MapLibre GL JS
 * Substitui ArcGIS Maps SDK por MapLibre + MapboxGLDraw + Turf.js
 * Mantém a mesma interface de props e comportamento visual.
 */
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import type { Polygon, Feature, FeatureCollection } from 'geojson';
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
}

/* ── Cores por tipo (fill, line) ── */
const TYPE_COLORS: Record<string, { fill: string; line: string; opacity: number }> = {
    rascunho: { fill: '#ffc107', line: '#ffc107', opacity: 0.2 },
    oficial: { fill: '#10b981', line: '#10b981', opacity: 0.25 },
    sobreposicao: { fill: '#ef4444', line: '#ef4444', opacity: 0.35 },
    vizinho: { fill: '#94a3b8', line: '#94a3b8', opacity: 0.15 },
    ativo: { fill: '#3b82f6', line: '#3b82f6', opacity: 0.3 },
};

export default function MapContainer({
    lotes = [],
    drawingEnabled = false,
    onGeometryChange,
    onLoteClick,
}: MapContainerProps) {
    const { setCursorCoords, activeTool, setToolResult, sketchTool, setSketchTool } = useApp();
    const mapDivRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const drawRef = useRef<InstanceType<typeof MapboxDraw> | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

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
                        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                    },
                },
                layers: [{ id: 'osm-layer', type: 'raster', source: 'osm' }],
            },
            center: [-47.93, -15.78],
            zoom: 13,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-left');

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

    /* ── Modo de desenho (MapboxDraw) ── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        if (drawingEnabled) {
            if (drawRef.current) return; // já existe

            // Fix de compatibilidade MapboxDraw + MapLibre:
            // MapLibre exige ["literal", [...]] para line-dasharray em expressões.
            // O theme padrão do Draw usa arrays diretos e causa erros de validação.
            const fixedStyles = [
                { id: 'gl-draw-polygon-fill-inactive', type: 'fill', filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'fill-color': '#3bb2d0', 'fill-outline-color': '#3bb2d0', 'fill-opacity': 0.1 } },
                { id: 'gl-draw-polygon-fill-active', type: 'fill', filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']], paint: { 'fill-color': '#fbb03b', 'fill-outline-color': '#fbb03b', 'fill-opacity': 0.1 } },
                { id: 'gl-draw-polygon-midpoint', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']], paint: { 'circle-radius': 3, 'circle-color': '#fbb03b' } },
                { id: 'gl-draw-polygon-stroke-inactive', type: 'line', filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#3bb2d0', 'line-width': 2 } },
                { id: 'gl-draw-polygon-stroke-active', type: 'line', filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fbb03b', 'line-dasharray': ['literal', [0.2, 2]], 'line-width': 2 } },
                { id: 'gl-draw-line-inactive', type: 'line', filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#3bb2d0', 'line-width': 2 } },
                { id: 'gl-draw-line-active', type: 'line', filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fbb03b', 'line-dasharray': ['literal', [0.2, 2]], 'line-width': 2 } },
                { id: 'gl-draw-polygon-and-line-vertex-stroke-inactive', type: 'circle', filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']], paint: { 'circle-radius': 5, 'circle-color': '#fff' } },
                { id: 'gl-draw-polygon-and-line-vertex-inactive', type: 'circle', filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']], paint: { 'circle-radius': 3, 'circle-color': '#fbb03b' } },
                { id: 'gl-draw-point-point-stroke-inactive', type: 'circle', filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']], paint: { 'circle-radius': 5, 'circle-opacity': 1, 'circle-color': '#fff' } },
                { id: 'gl-draw-point-inactive', type: 'circle', filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']], paint: { 'circle-radius': 3, 'circle-color': '#3bb2d0' } },
                { id: 'gl-draw-point-stroke-active', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'active', 'true'], ['!=', 'meta', 'midpoint']], paint: { 'circle-radius': 7, 'circle-color': '#fff' } },
                { id: 'gl-draw-point-active', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['!=', 'meta', 'midpoint'], ['==', 'active', 'true']], paint: { 'circle-radius': 5, 'circle-color': '#fbb03b' } },
                { id: 'gl-draw-polygon-fill-static', type: 'fill', filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'Polygon']], paint: { 'fill-color': '#404040', 'fill-outline-color': '#404040', 'fill-opacity': 0.1 } },
                { id: 'gl-draw-polygon-stroke-static', type: 'line', filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'Polygon']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#404040', 'line-width': 2 } },
                { id: 'gl-draw-line-static', type: 'line', filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'LineString']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#404040', 'line-width': 2 } },
                { id: 'gl-draw-point-static', type: 'circle', filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'Point']], paint: { 'circle-radius': 5, 'circle-color': '#404040' } },
            ];

            const draw = new MapboxDraw({
                displayControlsDefault: false,
                controls: { polygon: true, trash: true },
                defaultMode: 'draw_polygon',
                styles: fixedStyles as any,
            });

            // MapboxDraw.onAdd espera um mapa compatible; cast necessário por diferença de tipos
            map.addControl(draw as any, 'top-right');
            drawRef.current = draw;

            const onCreate = (e: { features: Feature[] }) => {
                const feature = e.features[0];
                if (feature?.geometry?.type === 'Polygon') {
                    const geojson = ringsToGeoJSON((feature.geometry as Polygon).coordinates[0]);
                    onGeometryChangeRef.current?.(geojson);
                }
            };
            const onUpdate = (e: { features: Feature[] }) => {
                const feature = e.features[0];
                if (feature?.geometry?.type === 'Polygon') {
                    const geojson = ringsToGeoJSON((feature.geometry as Polygon).coordinates[0]);
                    onGeometryChangeRef.current?.(geojson);
                }
            };

            map.on('draw.create', onCreate);
            map.on('draw.update', onUpdate);

            return () => {
                map.off('draw.create', onCreate);
                map.off('draw.update', onUpdate);
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
        const mode = sketchTool === 'polygon' ? 'draw_polygon' :
            sketchTool === 'rectangle' ? 'draw_polygon' :
                'draw_polygon';
        try { drawRef.current.changeMode(mode as any); } catch { }
        setSketchTool(null);
    }, [sketchTool, setSketchTool]);

    /* ── CAD Tool Execution ── */
    useToolExecution({
        map: mapRef.current,
        activeTool,
        onToolResult: setToolResult,
    });

    return (
        <div className="map-container">
            <div ref={mapDivRef} className="map-view" />

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