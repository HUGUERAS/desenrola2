/**
 * vertex-labels.ts — Store singleton para nomes de vértices
 * Armazena: featureId → vertexIndex → label customizado (ex: "P-01", "MM-01", "Marco 3")
 *
 * Usado por:
 * - useToolExecution (ferramenta renomear-vertices)
 * - exportDXF (inclui TEXT entities com os nomes)
 */

/** featureId → (vertexIndex → label) */
const _store = new Map<string, Map<number, string>>();

/** Define ou sobrescreve o label de um vértice */
export function setVertexLabel(featureId: string, vertexIdx: number, label: string): void {
    if (!_store.has(featureId)) _store.set(featureId, new Map());
    if (label.trim()) {
        _store.get(featureId)!.set(vertexIdx, label.trim());
    } else {
        _store.get(featureId)!.delete(vertexIdx);
    }
}

/** Retorna o label de um vértice, ou o padrão "V<idx+1>" se não tiver customizado */
export function getVertexLabel(featureId: string, vertexIdx: number): string {
    return _store.get(featureId)?.get(vertexIdx) ?? `V${vertexIdx + 1}`;
}

/** Retorna todos os labels customizados de uma feature */
export function getFeatureLabels(featureId: string): Map<number, string> {
    return _store.get(featureId) ?? new Map();
}

/** Verifica se há algum label customizado para uma feature */
export function hasCustomLabels(featureId: string): boolean {
    return (_store.get(featureId)?.size ?? 0) > 0;
}

/** Remove todos os labels de uma feature */
export function clearFeatureLabels(featureId: string): void {
    _store.delete(featureId);
}

/** Returna o store completo (para debug/export) */
export function getAllLabels(): Map<string, Map<number, string>> {
    return _store;
}

/** Label padrão quando não há customização */
export function defaultLabel(idx: number): string {
    return `V${idx + 1}`;
}
