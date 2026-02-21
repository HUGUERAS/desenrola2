export const DEFAULT_STATUS_COLOR = 'var(--text-muted)';

export const PROJECT_STATUS_COLOR: Record<string, string> = {
    RASCUNHO: '#94a3b8',
    EM_ANDAMENTO: '#3b82f6',
    CONCLUIDO: '#10b981',
    ARQUIVADO: '#6b7280',
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
    RASCUNHO: 'Rascunho',
    EM_ANDAMENTO: 'Em Andamento',
    CONCLUIDO: 'Concluido',
    ARQUIVADO: 'Arquivado',
};

export const LOTE_STATUS_COLOR: Record<string, string> = {
    PENDENTE: '#f59e0b',
    DESENHO: '#3b82f6',
    VALIDACAO: '#8b5cf6',
    APROVADO: '#10b981',
    REJEITADO: '#ef4444',
};

export function getStatusColor(
    status: string,
    palette: Record<string, string>,
    fallback: string = DEFAULT_STATUS_COLOR
): string {
    return palette[status] || fallback;
}

export function getStatusLabel(
    status: string,
    labels?: Record<string, string>
): string {
    if (!labels) return status;
    return labels[status] || status;
}
