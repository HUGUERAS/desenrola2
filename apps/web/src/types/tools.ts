/**
 * Types — Ferramentas CAD/GIS do Desenrola
 * 21 ferramentas em 5 categorias para regularizacao fundiaria
 */

export type ToolCategory =
  | 'medicao'
  | 'edicao'
  | 'topologia'
  | 'import-export'
  | 'sigef';

export type ToolId =
  // Medicao (5)
  | 'area'
  | 'perimetro'
  | 'angulo'
  | 'azimute'
  | 'coordenadas'
  // Edicao (5)
  | 'selecionar'
  | 'buffer'
  | 'dividir'
  | 'unir'
  | 'simplificar'
  // Topologia (3)
  | 'validar-topologia'
  | 'fechar-gaps'
  | 'simplificar-topologia'
  // Import/Export (6)
  | 'importar-kml'
  | 'importar-geojson'
  | 'importar-dxf'
  | 'importar-csv'
  | 'exportar-geojson'
  | 'exportar-dxf'
  // SIGEF + Coordenadas (6)
  | 'sigef-validar'
  | 'sigef-memorial'
  | 'sigef-vertices'
  | 'renomear-vertices'
  | 'converter-coords'
  | 'adicionar-ponto';

export interface ToolConfig {
  id: ToolId;
  label: string;
  icon: string;
  description: string;
  shortcut?: string;
  category: ToolCategory;
}

export interface ToolResult {
  type: string;
  value: number | string;
  unit?: string;
  geometry?: Record<string, any>;
  details?: Record<string, any>;
}

export interface LayerConfig {
  id: string;
  title: string;
  visible: boolean;
  opacity: number; // 0-100
  type: 'base' | 'tool' | 'import' | 'custom';
  removable?: boolean;
  color?: string; // Hex color
  features?: any[]; // GeoJSON features nesta camada
  locked?: boolean; // Se true, não pode editar
}

// Tool definitions per category
export const TOOL_DEFINITIONS: Record<ToolCategory, ToolConfig[]> = {
  medicao: [
    { id: 'area', label: 'Area', icon: 'square', description: 'Medir area do poligono (m2/ha)', shortcut: 'A', category: 'medicao' },
    { id: 'perimetro', label: 'Perimetro', icon: 'ruler', description: 'Medir perimetro do poligono (m)', shortcut: 'P', category: 'medicao' },
    { id: 'angulo', label: 'Angulo', icon: 'triangle', description: 'Medir angulo entre 3 pontos', shortcut: 'G', category: 'medicao' },
    { id: 'azimute', label: 'Azimute', icon: 'compass', description: 'Medir azimute entre 2 pontos', shortcut: 'Z', category: 'medicao' },
    { id: 'coordenadas', label: 'Coordenadas', icon: 'crosshair', description: 'Exibir coordenadas do cursor em tempo real', shortcut: 'C', category: 'medicao' },
  ],
  edicao: [
    { id: 'selecionar', label: 'Selecionar', icon: 'pen-tool', description: 'Selecionar e editar poligono (mover vertices, adicionar/remover)', shortcut: 'E', category: 'edicao' },
    { id: 'buffer', label: 'Buffer', icon: 'circle', description: 'Criar area de influencia ao redor da geometria', shortcut: 'B', category: 'edicao' },
    { id: 'dividir', label: 'Dividir', icon: 'scissors', description: 'Dividir poligono com linha de corte', shortcut: 'D', category: 'edicao' },
    { id: 'unir', label: 'Unir', icon: 'merge', description: 'Unir poligonos adjacentes', shortcut: 'U', category: 'edicao' },
    { id: 'simplificar', label: 'Simplificar', icon: 'minimize-2', description: 'Simplificar geometria reduzindo vertices', shortcut: 'S', category: 'edicao' },
  ],
  topologia: [
    { id: 'validar-topologia', label: 'Validar', icon: 'check-circle', description: 'Validar topologia do poligono', shortcut: 'V', category: 'topologia' },
    { id: 'fechar-gaps', label: 'Fechar Gaps', icon: 'git-merge', description: 'Detectar e fechar gaps entre poligonos', shortcut: 'F', category: 'topologia' },
    { id: 'simplificar-topologia', label: 'Simplificar Top.', icon: 'zap', description: 'Simplificar mantendo topologia valida', shortcut: 'T', category: 'topologia' },
  ],
  'import-export': [
    { id: 'importar-kml', label: 'Importar KML', icon: 'file-up', description: 'Importar arquivo KML/KMZ', shortcut: 'K', category: 'import-export' },
    { id: 'importar-geojson', label: 'Importar GeoJSON', icon: 'file-json', description: 'Importar arquivo GeoJSON', shortcut: 'J', category: 'import-export' },
    { id: 'importar-dxf', label: 'Importar DXF', icon: 'file-code', description: 'Importar arquivo DXF (AutoCAD/SIGEF)', shortcut: 'F', category: 'import-export' },
    { id: 'importar-csv', label: 'Importar CSV', icon: 'table', description: 'Importar vertices em CSV/TXT (lon,lat)', shortcut: 'I', category: 'import-export' },
    { id: 'exportar-geojson', label: 'Exportar GeoJSON', icon: 'file-down', description: 'Exportar geometria como GeoJSON', shortcut: 'E', category: 'import-export' },
    { id: 'exportar-dxf', label: 'Exportar DXF', icon: 'file-cog', description: 'Exportar geometria como DXF (CAD)', shortcut: 'X', category: 'import-export' },
  ],
  sigef: [
    { id: 'sigef-validar', label: 'Validar SIGEF', icon: 'shield-check', description: 'Validar geometria contra regras SIGEF', shortcut: 'V', category: 'sigef' },
    { id: 'sigef-memorial', label: 'Memorial', icon: 'file-text', description: 'Gerar memorial descritivo', shortcut: 'M', category: 'sigef' },
    { id: 'sigef-vertices', label: 'Vertices SIRGAS', icon: 'map-pin', description: 'Exportar vertices em SIRGAS 2000', shortcut: 'R', category: 'sigef' },
    { id: 'renomear-vertices', label: 'Renomear Vert.', icon: 'tag', description: 'Clicar em vertice para renomear (ex: P1, MM-01)', shortcut: 'N', category: 'sigef' },
    { id: 'converter-coords', label: 'Converter Coords', icon: 'repeat', description: 'Converter UTM / Geografico / DMS', shortcut: 'C', category: 'sigef' },
    { id: 'adicionar-ponto', label: 'Add Ponto', icon: 'plus-circle', description: 'Adicionar ponto por coordenadas', shortcut: 'P', category: 'sigef' },
  ],
};

export const CATEGORY_CONFIG: { id: ToolCategory; label: string; icon: string }[] = [
  { id: 'medicao', label: 'Medicao', icon: 'ruler' },
  { id: 'edicao', label: 'Edicao', icon: 'pen-tool' },
  { id: 'topologia', label: 'Topologia', icon: 'git-branch' },
  { id: 'import-export', label: 'Import/Export', icon: 'file-up' },
  { id: 'sigef', label: 'SIGEF', icon: 'shield' },
];
