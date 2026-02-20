/**
 * doc-generator — Gerador de documentos HTML para pecas tecnicas
 * Stub: sera implementado com template HTML
 */

export interface DadosDocumento {
  proprietario: {
    nome: string;
    cpf: string;
    rg?: string;
    profissao?: string;
    estado_civil?: string;
    nacionalidade?: string;
    email?: string;
    telefone?: string;
    endereco?: string;
    municipio?: string;
    estado?: string;
    uf?: string;
    cep?: string;
  };
  imovel: {
    nome?: string;
    denominacao?: string;
    municipio: string;
    uf?: string;
    estado?: string;
    area_ha?: number;
    comarca?: string;
    matricula?: string;
    gleba?: string;
    area_matricula?: number | string;
    lote_id?: string | number;
  };
  responsavel_tecnico?: {
    nome: string;
    cpf: string;
    qualificacao?: string;
    conselho_tipo?: string;
    conselho_num?: string;
    credenciamento_incra?: string;
    art_num?: string;
  };
  /** @deprecated use responsavel_tecnico */
  rt?: {
    nome: string;
    cpf: string;
    qualificacao: string;
    conselho_tipo: string;
    conselho_num: string;
    credenciamento_incra: string;
    art_num: string;
  };
  vertices?: number[][];
  confrontantes?: DadosConfrontante[];
  geom_wkt?: string;
}

export interface DadosConfrontante {
  nome: string;
  cpf?: string;
  lado?: string;
  direcao?: string;
  tipo_divisa?: string;
}

export function gerarRequerimentoOS(_dados: DadosDocumento): string {
  return '<html><body><h1>Requerimento OS - Em desenvolvimento</h1></body></html>';
}

export function gerarDeclaracaoLimites(_dados: DadosDocumento, _confrontante: DadosConfrontante): string {
  return '<html><body><h1>Declaracao de Limites - Em desenvolvimento</h1></body></html>';
}

export function gerarOrdemServico(_dados: DadosDocumento): string {
  return '<html><body><h1>Ordem de Servico - Em desenvolvimento</h1></body></html>';
}

export function gerarMemorialDescritivo(_dados: DadosDocumento): string {
  return '<html><body><h1>Memorial Descritivo - Em desenvolvimento</h1></body></html>';
}

export function gerarPlantaTopografica(_dados: DadosDocumento): string {
  return '<html><body><h1>Planta Topografica - Em desenvolvimento</h1></body></html>';
}

export function abrirDocumento(html: string, filename?: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'documento.html';
  a.click();
  URL.revokeObjectURL(url);
}
