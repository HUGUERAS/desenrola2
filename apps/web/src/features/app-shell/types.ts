/**
 * types.ts — Tipos de dados para o frontend do OpenClaw
 */

import type { LoteGeometry } from '../components/maps/MapContainer'; // Importa LoteGeometry

export type UserRole = 'proprietario' | 'topografo' | 'admin';

export type SidebarPanel = 'projetos' | 'lotes' | 'financeiro' | 'documentos' | 'configuracoes' | 'desenhar' | 'meus-dados' | 'cliente-dados' | 'confrontacoes' | 'validar' | 'sigef' | 'layers' | 'status' | 'pecas' | 'vizinhos' | null;

export interface Projeto {
  id: number;
  nomeProjeto: string;
  nomeCliente: string;
  cpfCnpjCliente: string | null;
  municipio: string | null;
  uf: string | null;
  statusProjeto: ProjectStatus;
  dataCriacao: string; // Usar string para consistência com API
  dataUltimaAtividade: string | null;
  responsavelTopografoId: string | null;
  descricao: string | null;
  lotes?: LoteGeometry[]; // Opcional: lista de lotes associados, para uso no frontend
}

export type ProjectStatus = 'Rascunho' | 'Em Andamento' | 'Aguardando Aprovação' | 'Concluído' | 'Pausado' | 'Cancelado';

export interface Lote {
  id: number;
  projeto_id: number;
  nome_cliente: string;
  cpf_cnpj_cliente: string | null;
  municipio: string | null;
  uf: string | null;
  status_lote: LoteStatus; // Similar ao statusProjeto, mas para o lote
  data_criacao: string;
  data_ultima_atividade: string | null;
  geojson: Record<string, any> | null;
  wkt: string | null;
  // Outros campos relevantes do lote, se houver
}

export type LoteStatus = 'Rascunho' | 'Desenhado' | 'Em Validação' | 'Validado' | 'Aguardando Registro' | 'Regularizado';

export interface AppState {
  role: UserRole | null;
  projetoAtual: Projeto | null;
  loteAtual: Lote | null;
  sidebarOpen: boolean;
  activeTool: ToolId | null;
  activeToolCategory: ToolCategory | null;
  toolResult: ToolResult | null;
  toolLayers: LayerConfig[];
  mapCursor: { lat: number; lon: number } | null;
  mapGeometries: LoteGeometry[];
  sketchTool: string | null; // Modo atual do MapboxDraw ('draw_polygon', 'simple_select', etc.)
  mapZoomTo: Record<string, any> | null; // GeoJSON para dar zoom
  // Novos estados para Projetos
  projetos: Projeto[];
  setProjetos: (proj: Projeto[]) => void;
  setProjetoAtual: (proj: Projeto | null) => void;
  // Outros estados...
  selectedPolygons: string[];
  setSelectedPolygons: (ids: string[]) => void;
  togglePolygonSelection: (id: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  bufferDistance: number;
  setBufferDistance: (dist: number) => void;
}

// Definições das ferramentas CAD (mantidas aqui para referência)
export * from './tools';

