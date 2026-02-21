import type { LoteGeometry } from '../../components/maps/MapContainer';
import type { LayerConfig } from '../../types/tools';
import type { Lote, SidebarPanel, UserRole } from './types';

type LoteApiShape = {
    id: number;
    geom?: string;
    geojson?: Record<string, any>;
    nome_cliente?: string;
    status?: string;
};

export function resolveInitialPanel(role: UserRole, lote: Lote | null): SidebarPanel {
    if (role === 'topografo') return 'projetos';
    return lote ? 'status' : 'desenhar';
}

export function mapLotesToGeometries(lotes: LoteApiShape[]): LoteGeometry[] {
    return lotes.map((l) => ({
        id: l.id,
        wkt: l.geom,
        geojson: l.geojson,
        label: l.nome_cliente,
        type: l.status === 'APROVADO' ? 'oficial' : 'rascunho',
    }));
}

export function mapUnknownLotesToGeometries(lotes: unknown[]): LoteGeometry[] {
    const safeLotes = lotes.filter((l): l is LoteApiShape => {
        if (!l || typeof l !== 'object') return false;
        return 'id' in l && typeof (l as { id?: unknown }).id === 'number';
    });
    return mapLotesToGeometries(safeLotes);
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

export function replaceDraftGeometry(geometries: LoteGeometry[], geometry: LoteGeometry): LoteGeometry[] {
    return geometries.filter((g) => g.id !== 0).concat(geometry);
}

export function buildMapClickLote(geometry: LoteGeometry): Lote {
    return {
        id: geometry.id,
        projeto_id: 0,
        nome_cliente: geometry.label || '',
        geom: geometry.wkt,
        geojson: geometry.geojson,
    };
}

export function upsertToolLayer(layers: LayerConfig[], layer: LayerConfig): LayerConfig[] {
    const exists = layers.some((l) => l.id === layer.id);
    if (!exists) return [...layers, layer];
    return layers.map((l) => (l.id === layer.id ? layer : l));
}

export function removeToolLayer(layers: LayerConfig[], layerId: string): LayerConfig[] {
    return layers.filter((l) => l.id !== layerId);
}
