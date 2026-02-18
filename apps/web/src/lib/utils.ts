/**
 * Converte geometria ArcGIS para GeoJSON (padrão do guia).
 * ✅ SEMPRE converta geometria para GeoJSON antes de salvar.
 */
export function geometryToGeoJSON(geometry: __esri.Polygon) {
    return {
        type: 'Polygon' as const,
        coordinates: geometry.rings,
        crs: {
            type: 'name',
            properties: { name: 'EPSG:4326' }
        }
    }
}

/**
 * Calcula área em m² a partir de geometria ArcGIS.
 */
export async function calcularAreaM2(geometry: __esri.Polygon): Promise<number> {
    const { geodesicArea } = await import('@arcgis/core/geometry/geometryEngine.js')
    const area = Math.abs(geodesicArea(geometry, 'square-meters'))
    return Math.round(area * 100) / 100
}

/**
 * Calcula perímetro em metros a partir de geometria ArcGIS.
 */
export async function calcularPerimetroM(geometry: __esri.Polygon): Promise<number> {
    const { geodesicLength } = await import('@arcgis/core/geometry/geometryEngine.js')
    const perimetro = geodesicLength(geometry, 'meters')
    return Math.round(perimetro * 100) / 100
}
