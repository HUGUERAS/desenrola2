/**
 * doc-generator — Gerador de documentos PDF para pecas tecnicas
 * Stub: sera implementado com jsPDF ou similar
 */

export interface DadosDocumento {
  proprietario: {
    nome: string;
    cpf: string;
    rg?: string;
    endereco?: string;
    municipio?: string;
    uf?: string;
  };
  imovel: {
    denominacao: string;
    municipio: string;
    uf: string;
    area_ha: number;
    comarca: string;
    matricula?: string;
  };
  rt: {
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
}

export interface DadosConfrontante {
  nome: string;
  cpf?: string;
  lado: string;
  tipo_divisa?: string;
}

export function gerarRequerimentoOS(_dados: DadosDocumento): Blob {
  // TODO: implementar com jsPDF
  return new Blob(['Requerimento OS - Em desenvolvimento'], { type: 'text/plain' });
}

export function gerarDeclaracaoLimites(_dados: DadosDocumento, _confrontante: DadosConfrontante): Blob {
  return new Blob(['Declaracao de Limites - Em desenvolvimento'], { type: 'text/plain' });
}

export function gerarOrdemServico(_dados: DadosDocumento): Blob {
  return new Blob(['Ordem de Servico - Em desenvolvimento'], { type: 'text/plain' });
}

export function gerarMemorialDescritivo(_dados: DadosDocumento): Blob {
  return new Blob(['Memorial Descritivo - Em desenvolvimento'], { type: 'text/plain' });
}

export function gerarPlantaTopografica(_dados: DadosDocumento): Blob {
  return new Blob(['Planta Topografica - Em desenvolvimento'], { type: 'text/plain' });
}

export function abrirDocumento(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
