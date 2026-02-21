import type { LoteGeometry } from '../../components/maps/MapContainer';
import type { Lote, SidebarPanel, UserRole } from './types';

export function resolveInitialPanel(role: UserRole, lote: Lote | null): SidebarPanel {
    if (role === 'topografo') return 'projetos';
    return lote ? 'status' : 'desenhar';
}

export function mapLotesToGeometries(lotes: any[]): LoteGeometry[] {
    return lotes.map((l) => ({
        id: l.id,
        wkt: l.geom,
        geojson: l.geojson,
        label: l.nome_cliente,
        type: l.status === 'APROVADO' ? 'oficial' : 'rascunho',
    }));
}

export function buildDrawingGeometry(
    targetId: number,
    geojson: Record<string, any>,
    label?: string
): LoteGeometry {
    return {
        id: targetId,
        geojson,
        type: targetId === 0 ? 'rascunho' : 'ativo',
        label: targetId === 0 ? 'Nova Area' : label,
    };
}

export function upsertGeometry(geometries: LoteGeometry[], geometry: LoteGeometry): LoteGeometry[] {
    const exists = geometries.some((g) => g.id === geometry.id);
    if (!exists) return [...geometries, geometry];
    return geometries.map((g) => (g.id === geometry.id ? geometry : g));
}
