/**
 * doc-generator — Gerador de documentos HTML para pecas tecnicas SEAPA
 * Gera HTML formatado para impressao A4 (Ctrl+P)
 */

import { wktToRings, calculateAreaM2, calculatePerimeterM, calculateCentroid, computeVertexTable, haversineDistance, azimuthToDMS } from './geo-utils';
import type { VertexRow } from './geo-utils';
import { getUTMZone, toDMS } from './geometry/CoordinateConversion';

/* ───────────────────────── Interfaces ───────────────────────── */

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
  imovel?: string;
  matricula?: string;
}

/* ───────────────────────── Helpers internos ───────────────────────── */

function safe(val: string | number | undefined | null, fallback = '________________'): string {
  if (val === undefined || val === null || val === '') return fallback;
  return String(val);
}

function getRT(dados: DadosDocumento) {
  return dados.responsavel_tecnico || dados.rt || null;
}

function resolveRing(dados: DadosDocumento): number[][] | null {
  if (dados.vertices && dados.vertices.length >= 3) return dados.vertices;
  if (dados.geom_wkt) {
    const rings = wktToRings(dados.geom_wkt);
    return rings ? rings[0] : null;
  }
  return null;
}

function uf(dados: DadosDocumento): string {
  return safe(dados.imovel.uf || dados.imovel.estado || dados.proprietario.uf || dados.proprietario.estado || 'GO');
}

const MESES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

function formatDatePT(municipio?: string, estado?: string): string {
  const d = new Date();
  const local = municipio ? `${municipio}-${estado || 'GO'}` : '________________-__';
  return `${local}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function baseCSS(landscape = false): string {
  return `
    @page { size: A4${landscape ? ' landscape' : ''}; margin: 20mm 15mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Georgia, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      padding: 20mm 15mm;
    }
    h1 { font-size: 14pt; text-align: center; text-transform: uppercase; margin-bottom: 20px; letter-spacing: 1px; }
    h2 { font-size: 12pt; text-transform: uppercase; margin: 18px 0 8px; border-bottom: 1px solid #000; padding-bottom: 2px; }
    h3 { font-size: 11pt; margin: 12px 0 6px; }
    p { text-align: justify; margin-bottom: 10px; text-indent: 2em; }
    p.no-indent { text-indent: 0; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .mt { margin-top: 30px; }
    .mt-lg { margin-top: 50px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
    th, td { border: 1px solid #000; padding: 4px 6px; text-align: center; }
    th { background: #f0f0f0; font-weight: bold; }
    .sig-block { margin-top: 60px; text-align: center; }
    .sig-line { border-top: 1px solid #000; width: 300px; margin: 0 auto 4px; padding-top: 4px; }
    .sig-name { font-weight: bold; }
    .sig-role { font-size: 10pt; }
    .witnesses { margin-top: 40px; }
    .witness-line { border-top: 1px solid #000; width: 260px; margin: 30px 0 4px; padding-top: 4px; }
    .header-block { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 140px 1fr; gap: 2px 8px; margin: 8px 0; font-size: 11pt; }
    .info-grid .lbl { font-weight: bold; text-align: right; }
    .info-grid .val { text-align: left; }
  `;
}

function wrapHTML(title: string, bodyContent: string, landscape = false): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${baseCSS(landscape)}</style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

function signatureBlock(nome: string, role: string, cpf?: string): string {
  return `
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${safe(nome)}</div>
      ${cpf ? `<div class="sig-role">CPF: ${safe(cpf)}</div>` : ''}
      <div class="sig-role">${role}</div>
    </div>`;
}

/* ───────────────────────── Doc 02: Requerimento de OS ───────────────────────── */

export function gerarRequerimentoOS(dados: DadosDocumento): string {
  const p = dados.proprietario;
  const im = dados.imovel;
  const rt = getRT(dados);
  const ufStr = uf(dados);

  const qualificacaoProprietario = [
    safe(p.nacionalidade, 'brasileiro(a)'),
    safe(p.estado_civil, ''),
    safe(p.profissao, ''),
  ].filter(v => v && v !== '________________').join(', ');

  const body = `
    <div class="header-block">
      <div class="bold" style="font-size:11pt;">ESTADO DE ${safe(p.estado || p.uf || 'GOIAS', 'GOIAS').toUpperCase()}</div>
      <div style="font-size:10pt;">Secretaria de Estado de Meio Ambiente e Desenvolvimento Sustentavel</div>
      <div style="font-size:10pt;">SEAPA — Regularizacao Fundiaria</div>
    </div>

    <h1>Requerimento de Ordem de Servico</h1>

    <p>
      Eu, <strong>${safe(p.nome)}</strong>${qualificacaoProprietario ? `, ${qualificacaoProprietario}` : ''},
      portador(a) do CPF n.&ordm; <strong>${safe(p.cpf)}</strong>
      ${p.rg ? `, RG n.&ordm; <strong>${safe(p.rg)}</strong>` : ''}
      ${p.endereco ? `, residente e domiciliado(a) em <strong>${safe(p.endereco)}</strong>, ${safe(p.municipio)}-${ufStr}` : ''}
      ${p.cep ? `, CEP ${safe(p.cep)}` : ''},
      venho respeitosamente requerer a Vossa Senhoria a emissao de
      <strong>Ordem de Servico</strong> para a realizacao de levantamento
      topografico georreferenciado do imovel abaixo descrito.
    </p>

    <h2>Dados do Imovel</h2>
    <div class="info-grid">
      <span class="lbl">Denominacao:</span><span class="val">${safe(im.nome || im.denominacao)}</span>
      <span class="lbl">Municipio:</span><span class="val">${safe(im.municipio)}-${ufStr}</span>
      ${im.matricula ? `<span class="lbl">Matricula:</span><span class="val">${safe(im.matricula)}</span>` : ''}
      ${im.gleba ? `<span class="lbl">Gleba:</span><span class="val">${safe(im.gleba)}</span>` : ''}
      ${im.area_matricula ? `<span class="lbl">Area Tit.:</span><span class="val">${safe(im.area_matricula)} ha</span>` : ''}
    </div>

    ${rt ? `
    <h2>Responsavel Tecnico Indicado</h2>
    <div class="info-grid">
      <span class="lbl">Nome:</span><span class="val">${safe(rt.nome)}</span>
      <span class="lbl">CPF:</span><span class="val">${safe(rt.cpf)}</span>
      <span class="lbl">Qualificacao:</span><span class="val">${safe(rt.qualificacao)}</span>
      <span class="lbl">${safe(rt.conselho_tipo, 'Conselho')}:</span><span class="val">${safe(rt.conselho_num)}</span>
      ${rt.credenciamento_incra ? `<span class="lbl">Cred. INCRA:</span><span class="val">${safe(rt.credenciamento_incra)}</span>` : ''}
      ${rt.art_num ? `<span class="lbl">ART/TRT:</span><span class="val">${safe(rt.art_num)}</span>` : ''}
    </div>
    ` : '<p class="no-indent"><em>Responsavel Tecnico nao informado.</em></p>'}

    <p class="no-indent mt">Nestes termos, pede deferimento.</p>

    <p class="no-indent center mt">${formatDatePT(im.municipio, ufStr)}</p>

    ${signatureBlock(p.nome, 'Requerente / Proprietario(a)', p.cpf)}
  `;

  return wrapHTML('Requerimento de Ordem de Servico', body);
}

/* ───────────────────────── Doc 03: Declaracao de Limites ───────────────────────── */

export function gerarDeclaracaoLimites(dados: DadosDocumento, confrontante: DadosConfrontante): string {
  const p = dados.proprietario;
  const im = dados.imovel;
  const ufStr = uf(dados);
  const direcao = safe(confrontante.direcao || confrontante.lado, '');
  const direcaoTexto = direcao ? ` ao lado <strong>${direcao.toUpperCase()}</strong> de` : ' confrontante ao imovel de';

  const body = `
    <div class="header-block">
      <div class="bold" style="font-size:11pt;">ESTADO DE ${safe(p.estado || p.uf || 'GOIAS', 'GOIAS').toUpperCase()}</div>
      <div style="font-size:10pt;">SEAPA — Regularizacao Fundiaria</div>
    </div>

    <h1>Declaracao de Respeito de Limites</h1>

    <p>
      Eu, <strong>${safe(confrontante.nome)}</strong>,
      portador(a) do CPF n.&ordm; <strong>${safe(confrontante.cpf)}</strong>,
      proprietario(a) do imovel${direcaoTexto}
      <strong>${safe(p.nome)}</strong>,
    </p>

    <p>
      <strong>DECLARO</strong>, para os devidos fins de regularizacao fundiaria,
      que reconheco e respeito os limites divisorios entre o meu imovel e o
      imovel denominado <strong>${safe(im.nome || im.denominacao)}</strong>,
      ${im.matricula ? `matricula n.&ordm; <strong>${safe(im.matricula)}</strong>,` : ''}
      de propriedade de <strong>${safe(p.nome)}</strong>,
      situado no municipio de <strong>${safe(im.municipio)}-${ufStr}</strong>,
      nao havendo qualquer litigio, duvida ou contestacao quanto as divisas
      existentes entre os referidos imoveis.
    </p>

    <p>
      Declaro ainda que as informacoes aqui prestadas sao verdadeiras,
      estando ciente das penalidades previstas em lei por falsidade ideologica.
    </p>

    <p class="no-indent center mt">${formatDatePT(im.municipio, ufStr)}</p>

    ${signatureBlock(confrontante.nome, 'Confrontante / Declarante', confrontante.cpf)}

    <div class="witnesses">
      <h3>Testemunhas:</h3>
      <div style="display:flex; gap:40px; margin-top:20px;">
        <div style="flex:1;">
          <div class="witness-line"></div>
          <div>Nome: ________________________________</div>
          <div>CPF: _________________________________</div>
        </div>
        <div style="flex:1;">
          <div class="witness-line"></div>
          <div>Nome: ________________________________</div>
          <div>CPF: _________________________________</div>
        </div>
      </div>
    </div>
  `;

  return wrapHTML(`Declaracao de Limites - ${safe(confrontante.nome)}`, body);
}

/* ───────────────────────── Doc 13: Ordem de Servico ───────────────────────── */

export function gerarOrdemServico(dados: DadosDocumento): string {
  const p = dados.proprietario;
  const im = dados.imovel;
  const rt = getRT(dados);
  const ufStr = uf(dados);
  const ano = new Date().getFullYear();

  const body = `
    <div class="header-block">
      <div class="bold" style="font-size:11pt;">ESTADO DE ${safe(p.estado || p.uf || 'GOIAS', 'GOIAS').toUpperCase()}</div>
      <div style="font-size:10pt;">SEAPA — Regularizacao Fundiaria</div>
    </div>

    <h1>Ordem de Servico N.&ordm; ____/${ano}</h1>

    <h2>Servico</h2>
    <p class="no-indent">
      Levantamento topografico georreferenciado para fins de regularizacao
      fundiaria, em conformidade com as normas tecnicas vigentes, utilizando
      o Sistema Geodesico Brasileiro — SIRGAS 2000.
    </p>

    <h2>Dados do Imovel</h2>
    <div class="info-grid">
      <span class="lbl">Denominacao:</span><span class="val">${safe(im.nome || im.denominacao)}</span>
      <span class="lbl">Municipio:</span><span class="val">${safe(im.municipio)}-${ufStr}</span>
      ${im.comarca ? `<span class="lbl">Comarca:</span><span class="val">${safe(im.comarca)}</span>` : ''}
      ${im.matricula ? `<span class="lbl">Matricula:</span><span class="val">${safe(im.matricula)}</span>` : ''}
      ${im.gleba ? `<span class="lbl">Gleba:</span><span class="val">${safe(im.gleba)}</span>` : ''}
      ${im.area_matricula ? `<span class="lbl">Area Tit.:</span><span class="val">${safe(im.area_matricula)} ha</span>` : ''}
    </div>

    <h2>Proprietario</h2>
    <div class="info-grid">
      <span class="lbl">Nome:</span><span class="val">${safe(p.nome)}</span>
      <span class="lbl">CPF:</span><span class="val">${safe(p.cpf)}</span>
      ${p.rg ? `<span class="lbl">RG:</span><span class="val">${safe(p.rg)}</span>` : ''}
      ${p.telefone ? `<span class="lbl">Telefone:</span><span class="val">${safe(p.telefone)}</span>` : ''}
      ${p.email ? `<span class="lbl">E-mail:</span><span class="val">${safe(p.email)}</span>` : ''}
    </div>

    ${rt ? `
    <h2>Profissional Designado</h2>
    <div class="info-grid">
      <span class="lbl">Nome:</span><span class="val">${safe(rt.nome)}</span>
      <span class="lbl">CPF:</span><span class="val">${safe(rt.cpf)}</span>
      <span class="lbl">Qualificacao:</span><span class="val">${safe(rt.qualificacao)}</span>
      <span class="lbl">${safe(rt.conselho_tipo, 'Conselho')}:</span><span class="val">${safe(rt.conselho_num)}</span>
      ${rt.credenciamento_incra ? `<span class="lbl">Cred. INCRA:</span><span class="val">${safe(rt.credenciamento_incra)}</span>` : ''}
      ${rt.art_num ? `<span class="lbl">ART/TRT:</span><span class="val">${safe(rt.art_num)}</span>` : ''}
    </div>
    ` : '<p class="no-indent"><em>Profissional tecnico nao informado.</em></p>'}

    <h2>Prazo</h2>
    <p class="no-indent">30 (trinta) dias uteis a partir da emissao desta Ordem de Servico.</p>

    <p class="no-indent center mt">${formatDatePT(im.municipio, ufStr)}</p>

    ${signatureBlock('', 'Responsavel pela Emissao')}

    ${rt ? signatureBlock(rt.nome, `${safe(rt.qualificacao)} — ${safe(rt.conselho_tipo)} ${safe(rt.conselho_num)}`, rt.cpf) : ''}

    ${signatureBlock(p.nome, 'Proprietario(a)', p.cpf)}
  `;

  return wrapHTML('Ordem de Servico', body);
}

/* ───────────────────────── Memorial Descritivo ───────────────────────── */

function buildPerimeterNarrative(table: VertexRow[]): string {
  if (table.length === 0) return '<p><em>Sem vertices para descricao.</em></p>';

  let text = `Inicia-se a descricao deste perimetro no vertice <strong>${table[0].label}</strong>, `;
  text += `de coordenadas geograficas latitude <strong>${table[0].latDMS}</strong> e `;
  text += `longitude <strong>${table[0].lonDMS}</strong>; `;

  for (let i = 0; i < table.length; i++) {
    const row = table[i];
    const nextIdx = (i + 1) % table.length;
    const nextRow = table[nextIdx];

    text += `deste, segue com azimute de <strong>${row.azimuthToNextDMS}</strong> `;
    text += `e distancia de <strong>${row.distanceToNext.toFixed(2)}m</strong> `;
    text += `ate o vertice <strong>${nextRow.label}</strong>, `;
    text += `de coordenadas geograficas latitude <strong>${nextRow.latDMS}</strong> e `;
    text += `longitude <strong>${nextRow.lonDMS}</strong>; `;
  }

  text += `ponto inicial da descricao deste perimetro.`;
  return `<p class="no-indent">${text}</p>`;
}

function buildCoordinateTableHTML(table: VertexRow[]): string {
  if (table.length === 0) return '<p><em>Sem coordenadas.</em></p>';

  let html = `
    <table>
      <thead>
        <tr>
          <th>Vertice</th>
          <th>Longitude</th>
          <th>Latitude</th>
          <th>Azimute</th>
          <th>Distancia (m)</th>
        </tr>
      </thead>
      <tbody>`;

  for (const row of table) {
    html += `
        <tr>
          <td>${row.label}</td>
          <td>${row.lonDMS}</td>
          <td>${row.latDMS}</td>
          <td>${row.azimuthToNextDMS}</td>
          <td>${row.distanceToNext.toFixed(2)}</td>
        </tr>`;
  }

  html += `
      </tbody>
    </table>`;
  return html;
}

function buildConfrontationsHTML(confrontantes?: DadosConfrontante[]): string {
  const direcoes = ['norte', 'sul', 'leste', 'oeste'];
  const map: Record<string, string[]> = {};
  for (const d of direcoes) map[d] = [];

  if (confrontantes) {
    for (const c of confrontantes) {
      const dir = (c.direcao || c.lado || '').toLowerCase();
      const nome = safe(c.nome, 'Nao identificado');
      if (map[dir]) {
        map[dir].push(nome);
      } else {
        // Direcao nao padrao — agrupa em "outras"
        if (!map['outras']) map['outras'] = [];
        map['outras'].push(`${dir}: ${nome}`);
      }
    }
  }

  let html = '<div class="info-grid" style="grid-template-columns: 80px 1fr;">';
  for (const d of direcoes) {
    const label = d.charAt(0).toUpperCase() + d.slice(1);
    const val = map[d].length > 0 ? map[d].join('; ') : 'Nao identificado';
    html += `<span class="lbl">${label}:</span><span class="val">${val}</span>`;
  }
  if (map['outras'] && map['outras'].length > 0) {
    html += `<span class="lbl">Outras:</span><span class="val">${map['outras'].join('; ')}</span>`;
  }
  html += '</div>';
  return html;
}

export function gerarMemorialDescritivo(dados: DadosDocumento): string {
  const p = dados.proprietario;
  const im = dados.imovel;
  const rt = getRT(dados);
  const ufStr = uf(dados);
  const ring = resolveRing(dados);

  let geoSection = '';
  let areaM2 = 0;
  let areaHa = 0;
  let perimetro = 0;

  if (ring && ring.length >= 3) {
    const table = computeVertexTable(ring);
    areaM2 = calculateAreaM2(ring);
    areaHa = areaM2 / 10000;
    perimetro = calculatePerimeterM(ring);
    const centroid = calculateCentroid(ring);
    const utmZone = getUTMZone(centroid[0]);

    geoSection = `
      <h2>4. Sistema Geodesico</h2>
      <div class="info-grid" style="grid-template-columns: 160px 1fr;">
        <span class="lbl">Datum:</span><span class="val">SIRGAS 2000 (EPSG:4674)</span>
        <span class="lbl">Projecao:</span><span class="val">Coordenadas Geograficas</span>
        <span class="lbl">Fuso UTM:</span><span class="val">${utmZone} Sul</span>
      </div>

      <h2>5. Descricao do Perimetro</h2>
      ${buildPerimeterNarrative(table)}

      <h2>6. Quadro de Coordenadas</h2>
      ${buildCoordinateTableHTML(table)}
      <p class="no-indent" style="margin-top:8px;">
        <strong>Area total:</strong> ${areaM2.toFixed(2)} m&sup2; = ${areaHa.toFixed(4)} ha
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>Perimetro total:</strong> ${perimetro.toFixed(2)} m
      </p>
    `;
  } else {
    geoSection = `
      <h2>4. Sistema Geodesico</h2>
      <p class="no-indent"><em>SEM GEOMETRIA DEFINIDA — coordenadas nao disponiveis.</em></p>
    `;
  }

  const body = `
    <div class="header-block">
      <div class="bold" style="font-size:11pt;">ESTADO DE ${safe(p.estado || p.uf || 'GOIAS', 'GOIAS').toUpperCase()}</div>
      <div style="font-size:10pt;">SEAPA — Regularizacao Fundiaria</div>
    </div>

    <h1>Memorial Descritivo</h1>

    <h2>1. Identificacao do Imovel</h2>
    <div class="info-grid">
      <span class="lbl">Denominacao:</span><span class="val">${safe(im.nome || im.denominacao)}</span>
      <span class="lbl">Municipio:</span><span class="val">${safe(im.municipio)}-${ufStr}</span>
      ${im.comarca ? `<span class="lbl">Comarca:</span><span class="val">${safe(im.comarca)}</span>` : ''}
      ${im.matricula ? `<span class="lbl">Matricula:</span><span class="val">${safe(im.matricula)}</span>` : ''}
      ${im.gleba ? `<span class="lbl">Gleba:</span><span class="val">${safe(im.gleba)}</span>` : ''}
      <span class="lbl">Area:</span><span class="val">${areaHa > 0 ? `${areaHa.toFixed(4)} ha (${areaM2.toFixed(2)} m&sup2;)` : safe(im.area_matricula ? `${im.area_matricula} ha (titulada)` : undefined)}</span>
      <span class="lbl">Perimetro:</span><span class="val">${perimetro > 0 ? `${perimetro.toFixed(2)} m` : 'Nao calculado'}</span>
    </div>

    <h2>2. Proprietario</h2>
    <div class="info-grid">
      <span class="lbl">Nome:</span><span class="val">${safe(p.nome)}</span>
      <span class="lbl">CPF:</span><span class="val">${safe(p.cpf)}</span>
      ${p.rg ? `<span class="lbl">RG:</span><span class="val">${safe(p.rg)}</span>` : ''}
      ${p.nacionalidade ? `<span class="lbl">Nacionalidade:</span><span class="val">${safe(p.nacionalidade)}</span>` : ''}
      ${p.estado_civil ? `<span class="lbl">Estado Civil:</span><span class="val">${safe(p.estado_civil)}</span>` : ''}
      ${p.profissao ? `<span class="lbl">Profissao:</span><span class="val">${safe(p.profissao)}</span>` : ''}
      ${p.endereco ? `<span class="lbl">Endereco:</span><span class="val">${safe(p.endereco)}, ${safe(p.municipio)}-${ufStr}</span>` : ''}
      ${p.email ? `<span class="lbl">E-mail:</span><span class="val">${safe(p.email)}</span>` : ''}
      ${p.telefone ? `<span class="lbl">Telefone:</span><span class="val">${safe(p.telefone)}</span>` : ''}
    </div>

    <h2>3. Responsavel Tecnico</h2>
    ${rt ? `
    <div class="info-grid">
      <span class="lbl">Nome:</span><span class="val">${safe(rt.nome)}</span>
      <span class="lbl">CPF:</span><span class="val">${safe(rt.cpf)}</span>
      <span class="lbl">Qualificacao:</span><span class="val">${safe(rt.qualificacao)}</span>
      <span class="lbl">${safe(rt.conselho_tipo, 'Conselho')}:</span><span class="val">${safe(rt.conselho_num)}</span>
      ${rt.credenciamento_incra ? `<span class="lbl">Cred. INCRA:</span><span class="val">${safe(rt.credenciamento_incra)}</span>` : ''}
      ${rt.art_num ? `<span class="lbl">ART/TRT:</span><span class="val">${safe(rt.art_num)}</span>` : ''}
    </div>
    ` : '<p class="no-indent"><em>Responsavel Tecnico nao informado.</em></p>'}

    ${geoSection}

    <h2>7. Confrontacoes</h2>
    ${buildConfrontationsHTML(dados.confrontantes)}

    <p class="no-indent center mt">${formatDatePT(im.municipio, ufStr)}</p>

    <div style="display:flex; gap:40px; justify-content:center; margin-top:40px;">
      <div style="flex:1; max-width:300px;">
        ${signatureBlock(p.nome, 'Proprietario(a)', p.cpf)}
      </div>
      ${rt ? `
      <div style="flex:1; max-width:300px;">
        ${signatureBlock(rt.nome, `${safe(rt.qualificacao)}\n${safe(rt.conselho_tipo)} ${safe(rt.conselho_num)}`, rt.cpf)}
      </div>
      ` : ''}
    </div>
  `;

  return wrapHTML('Memorial Descritivo', body);
}

/* ───────────────────────── Planta Topografica (SVG) ───────────────────────── */

function generatePolygonSVG(ring: number[][], width: number, height: number): string {
  const lons = ring.map(v => v[0]);
  const lats = ring.map(v => v[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);

  const padX = (maxLon - minLon) * 0.18 || 0.0001;
  const padY = (maxLat - minLat) * 0.18 || 0.0001;

  const bMinLon = minLon - padX, bMaxLon = maxLon + padX;
  const bMinLat = minLat - padY, bMaxLat = maxLat + padY;

  function toSVG(lon: number, lat: number): [number, number] {
    const x = ((lon - bMinLon) / (bMaxLon - bMinLon)) * width;
    const y = (1 - ((lat - bMinLat) / (bMaxLat - bMinLat))) * height;
    return [x, y];
  }

  // Strip closing vertex
  let verts = [...ring];
  if (verts.length > 3 &&
    verts[0][0] === verts[verts.length - 1][0] &&
    verts[0][1] === verts[verts.length - 1][1]) {
    verts = verts.slice(0, -1);
  }

  const svgPoints = verts.map(v => toSVG(v[0], v[1]));
  const pathD = svgPoints.map((pt, i) =>
    `${i === 0 ? 'M' : 'L'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`
  ).join(' ') + ' Z';

  // Vertex markers
  const markers = svgPoints.map((pt, i) => `
    <circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="5" fill="#e53e3e" stroke="#fff" stroke-width="1.5"/>
    <text x="${(pt[0] + 10).toFixed(1)}" y="${(pt[1] - 8).toFixed(1)}" font-size="11" font-family="Arial" fill="#1a1a1a" font-weight="bold">V-${String(i + 1).padStart(2, '0')}</text>
  `).join('');

  // Distance labels on edges
  const distLabels = svgPoints.map((pt, i) => {
    const next = svgPoints[(i + 1) % svgPoints.length];
    const mx = (pt[0] + next[0]) / 2;
    const my = (pt[1] + next[1]) / 2;
    const dist = haversineDistance(verts[i], verts[(i + 1) % verts.length]);
    return `<text x="${mx.toFixed(1)}" y="${(my - 4).toFixed(1)}" font-size="9" font-family="Arial" fill="#2b6cb0" text-anchor="middle">${dist.toFixed(2)}m</text>`;
  }).join('');

  // North arrow
  const nx = width - 40, ny = 35;
  const northArrow = `
    <g transform="translate(${nx},${ny})">
      <polygon points="0,-25 -8,5 0,-5 8,5" fill="#1a1a1a" stroke="#fff" stroke-width="0.5"/>
      <text x="0" y="-28" text-anchor="middle" font-size="12" font-weight="bold" font-family="Arial" fill="#1a1a1a">N</text>
    </g>
  `;

  // Scale bar
  const leftPt = toSVG(bMinLon, bMinLat);
  const rightPt = toSVG(bMaxLon, bMinLat);
  const pixelRange = rightPt[0] - leftPt[0];
  const groundRange = haversineDistance([bMinLon, bMinLat], [bMaxLon, bMinLat]);
  const metersPerPixel = groundRange / pixelRange;

  // Choose nice scale length
  const niceValues = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const targetPixels = width * 0.25;
  const targetMeters = targetPixels * metersPerPixel;
  let scaleMeters = niceValues[0];
  for (const v of niceValues) {
    if (v <= targetMeters * 1.2) scaleMeters = v;
  }
  const scalePixels = scaleMeters / metersPerPixel;

  const sx = 20, sy = height - 20;
  const scaleBar = `
    <g>
      <line x1="${sx}" y1="${sy}" x2="${sx + scalePixels}" y2="${sy}" stroke="#1a1a1a" stroke-width="2"/>
      <line x1="${sx}" y1="${sy - 4}" x2="${sx}" y2="${sy + 4}" stroke="#1a1a1a" stroke-width="2"/>
      <line x1="${sx + scalePixels}" y1="${sy - 4}" x2="${sx + scalePixels}" y2="${sy + 4}" stroke="#1a1a1a" stroke-width="2"/>
      <text x="${sx}" y="${sy + 14}" font-size="9" font-family="Arial" fill="#1a1a1a">0</text>
      <text x="${sx + scalePixels}" y="${sy + 14}" font-size="9" font-family="Arial" fill="#1a1a1a" text-anchor="end">${scaleMeters >= 1000 ? `${(scaleMeters / 1000).toFixed(1)}km` : `${scaleMeters}m`}</text>
    </g>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;border:1px solid #ccc;background:#fafafa;">
    <defs>
      <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e2e8f0" stroke-width="0.5"/>
      </pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#grid)"/>
    <path d="${pathD}" fill="rgba(59,130,246,0.12)" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round"/>
    ${distLabels}
    ${markers}
    ${northArrow}
    ${scaleBar}
  </svg>`;
}

function buildCarimbo(dados: DadosDocumento, areaHa: number, perimetro: number): string {
  const p = dados.proprietario;
  const im = dados.imovel;
  const rt = getRT(dados);
  const ufStr = uf(dados);
  const d = new Date();
  const data = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  return `
    <table style="font-size:9pt; margin-top:10px;">
      <tr>
        <th colspan="4" style="background:#2b6cb0;color:#fff;font-size:10pt;padding:6px;">
          PLANTA TOPOGRAFICA — ${safe(im.nome || im.denominacao)}
        </th>
      </tr>
      <tr>
        <td class="lbl" style="text-align:right;font-weight:bold;width:110px;">Municipio:</td>
        <td style="text-align:left;">${safe(im.municipio)}-${ufStr}</td>
        <td class="lbl" style="text-align:right;font-weight:bold;width:90px;">Matricula:</td>
        <td style="text-align:left;">${safe(im.matricula)}</td>
      </tr>
      <tr>
        <td style="text-align:right;font-weight:bold;">Proprietario:</td>
        <td style="text-align:left;">${safe(p.nome)}</td>
        <td style="text-align:right;font-weight:bold;">CPF:</td>
        <td style="text-align:left;">${safe(p.cpf)}</td>
      </tr>
      <tr>
        <td style="text-align:right;font-weight:bold;">Area:</td>
        <td style="text-align:left;">${areaHa > 0 ? `${areaHa.toFixed(4)} ha` : safe(im.area_matricula ? `${im.area_matricula} ha` : undefined)}</td>
        <td style="text-align:right;font-weight:bold;">Perimetro:</td>
        <td style="text-align:left;">${perimetro > 0 ? `${perimetro.toFixed(2)} m` : '—'}</td>
      </tr>
      ${rt ? `
      <tr>
        <td style="text-align:right;font-weight:bold;">Resp. Tecnico:</td>
        <td style="text-align:left;">${safe(rt.nome)}</td>
        <td style="text-align:right;font-weight:bold;">${safe(rt.conselho_tipo, 'Reg.')}:</td>
        <td style="text-align:left;">${safe(rt.conselho_num)}</td>
      </tr>
      ` : ''}
      <tr>
        <td style="text-align:right;font-weight:bold;">Datum:</td>
        <td style="text-align:left;">SIRGAS 2000</td>
        <td style="text-align:right;font-weight:bold;">Data:</td>
        <td style="text-align:left;">${data}</td>
      </tr>
    </table>
  `;
}

export function gerarPlantaTopografica(dados: DadosDocumento): string {
  const ring = resolveRing(dados);

  if (!ring || ring.length < 3) {
    return wrapHTML('Planta Topografica', `
      <div class="header-block">
        <h1>Planta Topografica</h1>
      </div>
      <p class="center mt-lg"><em>Geometria nao definida — impossivel gerar planta topografica.</em></p>
      <p class="center">Desenhe o poligono do lote no mapa antes de gerar este documento.</p>
    `, true);
  }

  const table = computeVertexTable(ring);
  const areaM2 = calculateAreaM2(ring);
  const areaHa = areaM2 / 10000;
  const perimetro = calculatePerimeterM(ring);

  const svgStr = generatePolygonSVG(ring, 800, 500);

  // Compact coordinate table
  let coordTable = `
    <table style="font-size:8.5pt;">
      <thead>
        <tr><th>Vert.</th><th>Longitude</th><th>Latitude</th><th>Azimute</th><th>Dist. (m)</th></tr>
      </thead>
      <tbody>`;
  for (const row of table) {
    coordTable += `
        <tr>
          <td>${row.label}</td>
          <td>${row.lonDMS}</td>
          <td>${row.latDMS}</td>
          <td>${row.azimuthToNextDMS}</td>
          <td>${row.distanceToNext.toFixed(2)}</td>
        </tr>`;
  }
  coordTable += '</tbody></table>';

  const body = `
    <div style="text-align:center; margin-bottom:10px;">
      ${svgStr}
    </div>

    <div style="display:flex; gap:10px; align-items:flex-start;">
      <div style="flex:1; overflow:auto;">
        <h3 style="font-size:10pt; margin-bottom:4px;">Quadro de Coordenadas</h3>
        ${coordTable}
      </div>
      <div style="flex:1.2;">
        ${buildCarimbo(dados, areaHa, perimetro)}
      </div>
    </div>
  `;

  return wrapHTML('Planta Topografica', body, true);
}

/* ───────────────────────── Utilitario: abrir documento ───────────────────────── */

export function abrirDocumento(html: string, filename?: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'documento.html';
  a.click();
  URL.revokeObjectURL(url);
}
