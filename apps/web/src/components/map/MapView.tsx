import { useEffect, useRef, useState } from 'react'
import Map from '@arcgis/core/Map'
import MapViewArcGIS from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel'
import Graphic from '@arcgis/core/Graphic'
import { geometryToGeoJSON, calcularAreaM2, calcularPerimetroM } from '@/lib/utils'
import type { GeoJSONPolygon } from '@/types'

interface Props {
    onGeometrySaved?: (geojson: GeoJSONPolygon, area: number, perimetro: number) => void
    initialGeometry?: GeoJSONPolygon | null
    editable?: boolean
}

export default function MapView({ onGeometrySaved, initialGeometry, editable = true }: Props) {
    const mapDiv = useRef<HTMLDivElement>(null)
    const viewRef = useRef<MapViewArcGIS | null>(null)
    const sketchRef = useRef<SketchViewModel | null>(null)
    const graphicsLayerRef = useRef<GraphicsLayer | null>(null)
    const [loading, setLoading] = useState(false)
    const [erro, setErro] = useState<string | null>(null)
    const [info, setInfo] = useState<{ area: number; perimetro: number } | null>(null)

    useEffect(() => {
        if (!mapDiv.current) return

        // ✅ Setup padrão conforme o guia ArcGIS
        const map = new Map({
            basemap: 'satellite'
        })

        const view = new MapViewArcGIS({
            container: mapDiv.current,
            map: map,
            center: [-47.8825, -15.7942], // Brasília default
            zoom: 12
        })

        // Layer para desenhos
        const graphicsLayer = new GraphicsLayer()
        map.add(graphicsLayer)
        graphicsLayerRef.current = graphicsLayer

        viewRef.current = view

        view.when(() => {
            if (editable) {
                // Sketch para desenhar
                const sketch = new SketchViewModel({
                    view: view,
                    layer: graphicsLayer,
                    creationMode: 'single',
                    defaultCreateOptions: {
                        mode: 'click'
                    },
                    polygonSymbol: {
                        type: 'simple-fill',
                        color: [51, 136, 255, 0.3],
                        outline: {
                            color: [51, 136, 255, 1],
                            width: 2
                        }
                    } as any
                })

                sketch.on('create', async (event) => {
                    if (event.state === 'complete') {
                        setLoading(true)
                        setErro(null)

                        try {
                            const polygon = event.graphic.geometry as __esri.Polygon
                            const geojson = geometryToGeoJSON(polygon)
                            const area = await calcularAreaM2(polygon)
                            const perimetro = await calcularPerimetroM(polygon)

                            setInfo({ area, perimetro })

                            if (onGeometrySaved) {
                                onGeometrySaved(geojson, area, perimetro)
                            }
                        } catch (error) {
                            console.error('Erro ao processar geometria:', error)
                            setErro('Erro ao calcular área e perímetro')
                        } finally {
                            setLoading(false)
                        }
                    }
                })

                sketchRef.current = sketch
            }
        })

        return () => {
            view.destroy()
        }
    }, [])

    function handleStartDraw() {
        if (sketchRef.current) {
            // Limpar desenhos anteriores
            if (graphicsLayerRef.current) {
                graphicsLayerRef.current.removeAll()
            }
            sketchRef.current.create('polygon')
        }
    }

    function handleClear() {
        if (graphicsLayerRef.current) {
            graphicsLayerRef.current.removeAll()
        }
        setInfo(null)
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Toolbar */}
            {editable && (
                <div className="flex gap-2">
                    <button
                        onClick={handleStartDraw}
                        disabled={loading}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                    >
                        ✏️ Desenhar Polígono
                    </button>
                    <button
                        onClick={handleClear}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
                    >
                        🗑️ Limpar
                    </button>
                </div>
            )}

            {/* Map Container */}
            <div
                ref={mapDiv}
                className="w-full h-[500px] rounded-lg border border-gray-300 shadow-sm"
            />

            {/* Info Panel */}
            {loading && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded">
                    ⏳ Calculando área e perímetro...
                </div>
            )}

            {erro && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                    {erro}
                </div>
            )}

            {info && (
                <div className="p-4 bg-green-50 border border-green-200 rounded">
                    <h4 className="font-semibold text-green-800 mb-2">📐 Medições</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-600">Área:</span>
                            <span className="font-bold text-green-700 ml-1">{info.area.toLocaleString('pt-BR')} m²</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Perímetro:</span>
                            <span className="font-bold text-green-700 ml-1">{info.perimetro.toLocaleString('pt-BR')} m</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
