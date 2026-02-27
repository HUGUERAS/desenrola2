import jsPDF from 'jspdf';
import { formatCPF } from './format-utils';

interface AnuenciaData {
  vizinho: {
    nome: string;
    cpf: string;
    imovel: string;
    matricula: string;
  };
  cliente: {
    nome: string;
    cpf: string;
    imovel: string;
    matricula: string;
    municipio: string;
    uf: string;
  };
  topografo: {
    nome: string;
    crea: string;
    empresa: string;
  };
}

export function gerarCartaAnuencia(data: AnuenciaData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  let y = 30;

  // Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('DECLARAÇÃO DE ANUÊNCIA E RESPEITO DE LIMITES', pageWidth / 2, y, { align: 'center' });
  
  y += 25;

  // Corpo do texto
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  
  const texto = `
Eu, ${data.vizinho.nome.toUpperCase()}, inscrito(a) no CPF sob o nº ${formatCPF(data.vizinho.cpf)}, proprietário(a) e/ou possuidor(a) do imóvel rural denominado "${data.vizinho.imovel}", matrícula nº ${data.vizinho.matricula}, confrontante com a área objeto desta regularização.

DECLARO, para os devidos fins de direito e de prova junto ao Oficial de Registro de Imóveis competente, que NÃO ME OPONHO e CONCORDO PLENAMENTE com o levantamento topográfico, memorial descritivo e planta apresentados.

O referido levantamento refere-se ao imóvel denominado "${data.cliente.imovel}", de propriedade de ${data.cliente.nome.toUpperCase()}, matrícula nº ${data.cliente.matricula}, localizado no município de ${data.cliente.municipio}-${data.cliente.uf}.

Declaro ainda que os limites e divisas apresentados na planta e memorial descritivo respeitam fielmente a posse e propriedade existente no local, nada tendo a reclamar presente ou futuramente quanto às divisas estabelecidas pelo Responsável Técnico ${data.topografo.nome} (CREA: ${data.topografo.crea}).
  `.trim();

  const splitText = doc.splitTextToSize(texto, contentWidth);
  doc.text(splitText, margin, y, { align: 'justify', maxWidth: contentWidth });

  y += (splitText.length * 7) + 20;

  // Local e Data
  const hoje = new Date();
  const dataExtenso = hoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`${data.cliente.municipio || 'Municipio'}, ${dataExtenso}.`, pageWidth / 2, y, { align: 'center' });

  y += 40;

  // Assinatura Vizinho
  doc.line(margin + 20, y, pageWidth - margin - 20, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(data.vizinho.nome.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`CPF: ${formatCPF(data.vizinho.cpf)}`, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('(Confrontante)', pageWidth / 2, y, { align: 'center' });

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Gerado via Desenrola Topografia - Responsável Técnico: ${data.topografo.nome}`, pageWidth / 2, 280, { align: 'center' });

  // Download
  const nomeArquivo = `anuencia_${data.vizinho.nome.replace(/\s+/g, '_').toLowerCase()}.pdf`;
  doc.save(nomeArquivo);
}
