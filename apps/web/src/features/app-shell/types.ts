import type { LoteGeometry } from '../../components/maps/MapContainer';
import type { LayerConfig, ToolCategory, ToolId, ToolResult } from '../../types/tools';

export type SidebarPanel =
    | 'projetos'
    | 'loteamentos'
    | 'lotes'
    | 'desenhar'
    | 'ferramentas'
    | 'camadas'
    | 'meus-dados'
    | 'confrontacoes'
    | 'validar'
    | 'vizinhos'
    | 'pecas'
    | 'documentos'
    | 'financeiro'
    | 'status'
    | 'cliente-dados';

export type UserRole = 'topografo' | 'proprietario';

export interface Projeto {
    id: number;
    nome: string;
    descricao?: string;
    tipo?: string;
    status?: string;
}

export interface Lote {
    id: number;
    projeto_id: number;
    nome_cliente: string;
    email_cliente?: string;
    telefone_cliente?: string;
    cpf_cnpj_cliente?: string;
    rg_cliente?: string;
    estado_civil_cliente?: string;
    municipio?: string;
    uf?: string;
    comarca?: string;
    codigo_sigef?: string;
    denominacao_imovel?: string;
    matricula_imovel?: string;
    token_acesso?: string;
    geom?: string;
    geojson?: Record<string, any>;
    status?: string;
}

export interface AppState {
    panel: SidebarPanel;
    role: UserRole;
    projetoAtual: Projeto | null;
    loteAtual: Lote | null;
    sidebarOpen: boolean;
    mapCursor: { lat: number; lon: number } | null;
    mapGeometries: LoteGeometry[];
    activeTool: ToolId | null;
    activeToolCategory: ToolCategory;
    toolResult: ToolResult | null;
    toolLayers: LayerConfig[];
    sketchTool: string | null;
    mapZoomTo: Record<string, any> | null;
}

export const defaultToolLayers: LayerConfig[] = [
    { id: 'lotes-layer', title: 'Lotes', visible: true, opacity: 100, type: 'base' },
    { id: 'desenho-layer', title: 'Desenho', visible: true, opacity: 100, type: 'base' },
];

export const initialAppState: AppState = {
    panel: 'projetos',
    role: 'proprietario',
    projetoAtual: null,
    loteAtual: null,
    sidebarOpen: true,
    mapCursor: null,
    mapGeometries: [],
    activeTool: null,
    activeToolCategory: 'medicao',
    toolResult: null,
    sketchTool: null,
    mapZoomTo: null,
    toolLayers: defaultToolLayers,
};
