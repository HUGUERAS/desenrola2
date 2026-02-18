/**
 * DrawMapEsri: Mapa de desenho usando ArcGIS Maps SDK for JavaScript.
 * Substitui OpenLayers com Vector Tiles e ferramentas nativas da Esri.
 */
import { useEffect, useRef, useState } from 'react';
import MapView from '@arcgis/core/views/MapView';
import Map from '@arcgis/core/Map';
import Sketch from '@arcgis/core/widgets/Sketch';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
import esriConfig from '@arcgis/core/config';
import '@arcgis/core/assets/esri/themes/light/main.css';

interface DrawMapEsriProps {
    onGeometryChange?: (wkt: string) => void;
    initialCenter?: [number, number]; // [lon, lat]
    initialZoom?: number;
    basemap?: 'streets-vector' | 'topo-vector' | 'satellite' | 'hybrid';
}

export default function DrawMapEsri({
    onGeometryChange,
    initialCenter = [-47.9292, -15.7801],
    initialZoom = 15,
    basemap = 'topo-vector',
    className = '',
    style = {},
}: DrawMapEsriProps & { className?: string; style?: React.CSSProperties }) {
    const mapRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const [, setReady] = useState(false);

    useEffect(() => {
        if (!mapRef.current) return;

        // Configurar API key da Esri (se disponível)
        const apiKey = import.meta.env.VITE_ESRI_API_KEY;
        if (apiKey) esriConfig.apiKey = apiKey;

        // GraphicsLayer para desenhos do usuário
        const graphicsLayer = new GraphicsLayer({ title: 'Desenhos' });

        // Criar mapa
        const map = new Map({
            basemap: basemap,
            layers: [graphicsLayer],
        });

        // View
        const view = new MapView({
            container: mapRef.current,
            map: map,
            center: initialCenter,
            zoom: initialZoom,
        });

        viewRef.current = view;

        // Widget de desenho (Sketch)
        const sketch = new Sketch({
            view: view,
            layer: graphicsLayer,
            creationMode: 'single',
            availableCreateTools: ['polygon'],
            defaultCreateOptions: { mode: 'click' },
        });

        view.ui.add(sketch, 'top-right');

        // Listener: quando desenho é criado
        sketch.on('create', (event) => {
            if (event.state === 'complete' && event.graphic?.geometry) {
                const geom = event.graphic.geometry;
                if (geom.type === 'polygon') {
                    const wkt = polygonToWKT(geom as __esri.Polygon);
                    if (wkt && onGeometryChange) onGeometryChange(wkt);
                }
            }
        });

        setReady(true);

        return () => {
            view.destroy();
        };
    }, [initialCenter, initialZoom, basemap, onGeometryChange]);

    return (
        <div className="draw-map-container" style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
            <div
                ref={mapRef}
                className={className}
                style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '8px',
                    overflow: 'hidden',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    background: 'rgba(255,255,255,0.95)',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
            >
                <strong><span role="img" aria-label="Localização">📍</span> Como usar:</strong> Use as ferramentas à direita para desenhar o polígono
            </div>
        </div>
    );
}

/**
 * Converte Polygon Esri para WKT (EPSG:4326).
 */
function polygonToWKT(polygon: __esri.Polygon): string {
    if (!polygon.rings || polygon.rings.length === 0) return '';

    // Converter Web Mercator (3857) para Geographic (4326)
    const geog = webMercatorUtils.webMercatorToGeographic(polygon) as __esri.Polygon;
    const coords = geog.rings[0];
    const pairs = coords.map(([lon, lat]) => `${lon} ${lat}`).join(', ');
    return `POLYGON((${pairs}))`;
}
