/**
 * doc-generator.ts — Motor de geração de documentos SEAPA
 * Gera HTML formatado para impressão/PDF via window.print()
 *
 * Documentos obrigatórios:
 *   02 - Requerimento de Ordem de Serviço
 *   03 - Declaração de Respeito de Limites
 *   13 - Ordem de Serviço
 *   Memorial Descritivo
 *   Planta Topográfica
 */

import { wktToRings, calculateAreaM2, calculatePerimeterM } from './geo-utils';

// ── Tipos ──

export interface DadosProprietario {
  nome: string;
  cpf: string;
  rg?: string;
  profissao?: string;
  estado_civil?: string;
  nacionalidade?: string;
  email?: string;
  endereco?: string;
  municipio?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
}

export interface DadosImovel {
  nome: string;
  area_ha?: number;
  area_matricula?: string;
  municipio: string;
  estado: string;
  matricula?: string;
  gleba?: string;
  lote_id?: number;
}

export interface DadosResponsavelTecnico {
  nome: string;
  cpf: string;
  qualificacao: string; // ex: "TÉCNICO EM AGRIMENSURA"
  conselho_tipo: string; // ex: "CFT", "CREA"
  conselho_num: string;
  credenciamento_incra: string;
  art_num?: string;
}

export interface DadosConfrontante {
  nome: string;
  cpf: string;
  imovel: string;
  matricula: string;
  direcao: string;
}

export interface Vertice {
  codigo: string;
  longitude: string;
  latitude: string;
  altitude?: string;
  azimute_vante?: string;
  distancia_vante?: string;
  codigo_vante?: string;
}

export interface DadosDocumento {
  proprietario: DadosProprietario;
  imovel: DadosImovel;
  responsavel_tecnico: DadosResponsavelTecnico;
  confrontantes?: DadosConfrontante[];
  vertices?: Vertice[];
  geom_wkt?: string;
  data_documento?: string;
  numero_processo?: string;
  numero_os?: string;
}

// ── CSS para impressão ──

const PRINT_CSS = `
  @page { size: A4; margin: 25mm 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #000; }
  .doc-page { max-width: 170mm; margin: 0 auto; }
  .doc-header { text-align: center; margin-bottom: 20pt; }
  .doc-header img { max-height: 60px; }
  .doc-header h1 { font-size: 14pt; margin: 10pt 0 5pt; text-transform: uppercase; }
  .doc-header h2 { font-size: 12pt; font-weight: normal; }
  .doc-header .org { font-size: 10pt; color: #333; }
  .doc-body { text-align: justify; }
  .doc-body p { margin-bottom: 10pt; text-indent: 2em; }
  .doc-body p.no-indent { text-indent: 0; }
  .doc-table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 9pt; }
  .doc-table th, .doc-table td { border: 1px solid #000; padding: 4pt 6pt; text-align: center; }
  .doc-table th { background: #f0f0f0; font-weight: bold; }
  .doc-sig { margin-top: 40pt; }
  .doc-sig-line { border-top: 1px solid #000; width: 60%; margin: 30pt auto 5pt; text-align: center; }
  .doc-sig-name { text-align: center; font-weight: bold; }
  .doc-sig-role { text-align: center; font-size: 10pt; color: #333; }
  .doc-field { margin-bottom: 6pt; }
  .doc-field label { font-weight: bold; }
  .doc-field-line { border-bottom: 1px solid #000; min-width: 200px; display: inline-block; }
  .doc-datum { font-size: 10pt; margin: 10pt 0; padding: 8pt; background: #f8f8f8; border: 1px solid #ddd; }
  .doc-obs { font-size: 9pt; font-style: italic; margin-top: 15pt; }
  .doc-local-data { margin-top: 30pt; }
  @media print { .no-print { display: none; } }
`;

// ── Funções auxiliares ──

function formatDate(date?: string): string {
  if (date) return date;
  const d = new Date();
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function verticesFromWkt(wkt?: string): Vertice[] {
  if (!wkt) return [];
  const rings = wktToRings(wkt);
  if (!rings || !rings[0]) return [];

  const coords = rings[0];
  const vertices: Vertice[] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const [lon, lat] = coords[i];
    const next = coords[(i + 1) % (coords.length - 1)];

    // Calcular azimute geodésico
    const dLon = (next[0] - lon) * Math.PI / 180;
    const lat1 = lat * Math.PI / 180;
    const lat2 = next[1] * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let az = Math.atan2(y, x) * 180 / Math.PI;
    if (az < 0) az += 360;

    // Calcular distância
    const midLat = (lat + next[1]) / 2;
    const degToMH = 111320 * Math.cos(midLat * Math.PI / 180);
    const degToMV = 110540;
    const dx = (next[0] - lon) * degToMH;
    const dy = (next[1] - lat) * degToMV;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const nextIdx = (i + 1) % (coords.length - 1);

    vertices.push({
      codigo: `V-${String(i + 1).padStart(2, '0')}`,
      longitude: formatCoord(lon, 'lon'),
      latitude: formatCoord(lat, 'lat'),
      altitude: '0,00',
      azimute_vante: formatDMS(az),
      distancia_vante: dist.toFixed(2),
      codigo_vante: `V-${String(nextIdx + 1).padStart(2, '0')}`,
    });
  }

  return vertices;
}

function formatCoord(dec: number, type: 'lat' | 'lon'): string {
  const abs = Math.abs(dec);
  const d = Math.floor(abs);
  const mf = (abs - d) * 60;
  const m = Math.floor(mf);
  const s = ((mf - m) * 60).toFixed(4);
  const dir = type === 'lat' ? (dec < 0 ? 'S' : 'N') : (dec < 0 ? 'O' : 'L');
  return `${d}°${String(m).padStart(2, '0')}'${s}"${dir}`;
}

function formatDMS(dec: number): string {
  const d = Math.floor(dec);
  const mf = (dec - d) * 60;
  const m = Math.floor(mf);
  const s = ((mf - m) * 60).toFixed(2);
  return `${d}°${String(m).padStart(2, '0')}'${s}"`;
}

// ── Geração HTML de cada documento ──

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="doc-page">
    ${body}
  </div>
  <script>
    // Auto-print quando abrir
    // window.print();
  </script>
</body>
</html>`;
}

function headerSeapa(): string {
  return `
    <div class="doc-header">
      <div class="org">GOVERNO DO ESTADO DE GOIÁS</div>
      <div class="org">SECRETARIA DE ESTADO DE AGRICULTURA, PECUÁRIA E ABASTECIMENTO - SEAPA</div>
      <div class="org">GERÊNCIA DE POLÍTICA FUNDIÁRIA E REGULARIZAÇÃO - GPRF</div>
    </div>`;
}

function tabelaVertices(vertices: Vertice[]): string {
  if (vertices.length === 0) return '<p><em>Sem vértices disponíveis</em></p>';

  let rows = '';
  for (const v of vertices) {
    rows += `<tr>
      <td>${v.codigo}</td>
      <td>${v.longitude}</td>
      <td>${v.latitude}</td>
      <td>${v.altitude || '-'}</td>
      <td>${v.codigo_vante || '-'}</td>
      <td>${v.azimute_vante || '-'}</td>
      <td>${v.distancia_vante || '-'}</td>
    </tr>`;
  }

  return `
    <div class="doc-datum">
      <strong>DATUM:</strong> SIRGAS 2000 &nbsp;&nbsp;
      <strong>SRID:</strong> 4674 &nbsp;&nbsp;
      <strong>S.G.L.</strong> (Sistema Geodésico Local)
    </div>
    <table class="doc-table">
      <thead>
        <tr>
          <th colspan="4">VÉRTICE</th>
          <th colspan="3">SEGMENTO VANTE</th>
        </tr>
        <tr>
          <th>Código</th>
          <th>Longitude<br>(geodésica)</th>
          <th>Latitude<br>(geodésica)</th>
          <th>Altitude<br>(m)</th>
          <th>Código</th>
          <th>Azimute<br>(geodésico)</th>
          <th>Distância<br>(m)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── 02 - Requerimento de Ordem de Serviço ──

export function gerarRequerimentoOS(dados: DadosDocumento): string {
  const { proprietario: p, imovel: im, responsavel_tecnico: rt } = dados;

  const qualificacao = [
    p.nacionalidade,
    p.estado_civil,
    p.profissao
  ].filter(Boolean).join(', ');

  const enderecoImovel = [
    im.nome,
    im.gleba ? `Gleba ${im.gleba}` : '',
    im.matricula ? `Matrícula ${im.matricula}` : ''
  ].filter(Boolean).join(', ');

  const body = `
    ${headerSeapa()}
    <h1 style="text-align:center; font-size:13pt; margin:15pt 0;">REQUERIMENTO DE ORDEM DE SERVIÇO</h1>
    <div class="doc-body">
      <p>Eu, <strong>${p.nome}</strong>, ${qualificacao}, portador do CPF nº <strong>${p.cpf}</strong> e RG nº <strong>${p.rg || '__________'}</strong>, residente e domiciliado em ${p.endereco || '________________'}, Município de ${p.municipio || '__________'}-${p.estado || 'GO'}, Telefone: ${p.telefone || '__________'}.</p>
      
      <p>Na qualidade de ocupante/proprietário do imóvel rural denominado <strong>${enderecoImovel}</strong>, localizado no Município de <strong>${im.municipio}-${im.estado}</strong>.</p>

      <p>Venho por meio deste instrumento, solicitar a emissão da ordem de serviço para execução dos serviços topográficos de medição, demarcação e georreferenciamento para o imóvel rural objeto do requerimento de titulação, para o profissional <strong>${rt.nome}</strong>, cadastrado nesta Gerência, portador do CPF: <strong>${rt.cpf}</strong>, registro profissional <strong>${rt.conselho_tipo} ${rt.conselho_num}</strong> e código do INCRA: <strong>${rt.credenciamento_incra}</strong>.</p>

      <div class="doc-local-data">
        <p class="no-indent">${im.municipio} - ${im.estado}, ${formatDate(dados.data_documento)}</p>
      </div>

      <div class="doc-sig">
        <div class="doc-sig-line"></div>
        <div class="doc-sig-name">${p.nome}</div>
        <div class="doc-sig-role">Assinatura do requerente</div>
      </div>

      <div class="doc-sig">
        <div class="doc-sig-line"></div>
        <div class="doc-sig-name">${rt.nome}</div>
        <div class="doc-sig-role">Assinatura do profissional</div>
      </div>

      <p class="doc-obs">OBS: Requerimento com firma reconhecida</p>
    </div>`;

  return wrapHtml('02 - Requerimento de Ordem de Serviço', body);
}

// ── 03 - Declaração de Respeito de Limites ──

export function gerarDeclaracaoLimites(dados: DadosDocumento, confrontante: DadosConfrontante): string {
  const { proprietario: p, imovel: im, responsavel_tecnico: rt } = dados;
  const vertices = dados.vertices || verticesFromWkt(dados.geom_wkt);

  const qualificacao = [
    p.nacionalidade,
    p.estado_civil,
    p.profissao
  ].filter(Boolean).join(', ');

  const imovelDetalhe = [
    im.nome,
    im.gleba ? `Gleba ${im.gleba}` : ''
  ].filter(Boolean).join(', ');

  const body = `
    ${headerSeapa()}
    <h1 style="text-align:center; font-size:13pt; margin:15pt 0;">DECLARAÇÃO INDIVIDUAL DE RESPEITO DE LIMITES</h1>
    <h2 style="text-align:center; font-size:11pt; margin-bottom:15pt;">Proprietário Pessoa Física</h2>
    <div class="doc-body">
      <p><strong>${p.nome}</strong>, ${qualificacao}, CPF nº <strong>${p.cpf}</strong>, RG nº <strong>${p.rg || '__________'}</strong>, proprietário do imóvel rural denominado <strong>${imovelDetalhe}</strong>, matrícula nº <strong>${im.matricula || '______'}</strong>, declaro sob as penas da Lei que quando dos trabalhos topográficos executados na citada propriedade pelo ${rt.qualificacao} <strong>${rt.nome}</strong>, ${rt.conselho_tipo} nº <strong>${rt.conselho_num}</strong>, CPF nº <strong>${rt.cpf}</strong>, credenciado pelo INCRA sob o código <strong>${rt.credenciamento_incra}</strong>, foram respeitados os limites de "divisas in loco" com o meu confrontante:</p>
      
      <p><strong>${confrontante.nome}</strong>, CPF nº <strong>${confrontante.cpf}</strong>, proprietário do imóvel rural denominado <strong>${confrontante.imovel}</strong>, matrícula nº <strong>${confrontante.matricula}</strong>.</p>

      <p>E assim, munidos de boa fé, conjuntamente com os que assinam, declaram não haver qualquer litígio entre as partes.</p>

      <p class="no-indent"><strong>O trecho confrontante possui os seguintes elementos técnicos:</strong></p>

      ${tabelaVertices(vertices)}

      <div class="doc-local-data">
        <p class="no-indent">${im.municipio} - ${im.estado}, ${formatDate(dados.data_documento)}</p>
      </div>

      <div class="doc-sig">
        <div class="doc-sig-line"></div>
        <div class="doc-sig-name">${p.nome}</div>
        <div class="doc-sig-role">Proprietário</div>
      </div>

      <div class="doc-sig">
        <div class="doc-sig-line"></div>
        <div class="doc-sig-name">${confrontante.nome}</div>
        <div class="doc-sig-role">Confrontante</div>
      </div>

      <p class="no-indent" style="margin-top:20pt;">Credenciado como testemunha:</p>
      <div class="doc-sig">
        <div class="doc-sig-line"></div>
        <div class="doc-sig-name">${rt.nome}</div>
        <div class="doc-sig-role">${rt.qualificacao}</div>
        <div class="doc-sig-role">${rt.conselho_tipo}: ${rt.conselho_num}</div>
        <div class="doc-sig-role">Credenciamento INCRA: ${rt.credenciamento_incra}</div>
        ${rt.art_num ? `<div class="doc-sig-role">ART nº ${rt.art_num}</div>` : ''}
      </div>

      <p class="doc-obs">Anexo Mapa e Memorial Descritivo</p>
    </div>`;

  return wrapHtml('03 - Declaração de Respeito de Limites', body);
}

// ── 13 - Ordem de Serviço ──

export function gerarOrdemServico(dados: DadosDocumento): string {
  const { proprietario: p, imovel: im, responsavel_tecnico: rt } = dados;

  const body = `
    ${headerSeapa()}
    <h1 style="text-align:center; font-size:13pt; margin:15pt 0;">ORDEM DE SERVIÇO EXTERNO / INSPEÇÃO</h1>
    <div class="doc-body">
      <table class="doc-table" style="font-size:11pt;">
        <tr><td style="text-align:left;"><strong>Nº da O.S.:</strong> ${dados.numero_os || '____/____'}</td></tr>
        <tr><td style="text-align:left;"><strong>Nº do Processo:</strong> ${dados.numero_processo || '________________'}</td></tr>
      </table>

      <p class="no-indent" style="margin-top:15pt;"><strong>1. DADOS DO REQUERENTE</strong></p>
      <table class="doc-table" style="font-size:10pt; text-align:left;">
        <tr><td><strong>Nome:</strong> ${p.nome}</td></tr>
        <tr><td><strong>CPF:</strong> ${p.cpf}</td></tr>
        <tr><td><strong>Endereço:</strong> ${p.endereco || '________________'}</td></tr>
        <tr><td><strong>Telefone:</strong> ${p.telefone || '________________'} &nbsp;&nbsp; <strong>E-mail:</strong> ${p.email || '________________'}</td></tr>
      </table>

      <p class="no-indent" style="margin-top:15pt;"><strong>2. DADOS DO IMÓVEL</strong></p>
      <table class="doc-table" style="font-size:10pt; text-align:left;">
        <tr><td><strong>Nome do Imóvel:</strong> ${im.nome}</td></tr>
        <tr><td><strong>Município:</strong> ${im.municipio} - ${im.estado}</td></tr>
        <tr><td><strong>Área:</strong> ${im.area_ha ? im.area_ha.toFixed(4) + ' ha' : (im.area_matricula || '________ ha')}</td></tr>
        <tr><td><strong>Matrícula:</strong> ${im.matricula || '________________'}</td></tr>
        ${im.gleba ? `<tr><td><strong>Gleba:</strong> ${im.gleba}</td></tr>` : ''}
      </table>

      <p class="no-indent" style="margin-top:15pt;"><strong>3. PROFISSIONAL DESIGNADO</strong></p>
      <table class="doc-table" style="font-size:10pt; text-align:left;">
        <tr><td><strong>Nome:</strong> ${rt.nome}</td></tr>
        <tr><td><strong>CPF:</strong> ${rt.cpf}</td></tr>
        <tr><td><strong>${rt.conselho_tipo}:</strong> ${rt.conselho_num}</td></tr>
        <tr><td><strong>Código INCRA:</strong> ${rt.credenciamento_incra}</td></tr>
      </table>

      <p class="no-indent" style="margin-top:15pt;"><strong>4. SERVIÇO A EXECUTAR</strong></p>
      <p>Medição, demarcação e georreferenciamento do imóvel rural acima descrito, conforme normas técnicas do INCRA e legislação vigente, com utilização de DATUM SIRGAS 2000 (SRID 4674).</p>

      <div class="doc-local-data">
        <p class="no-indent">${im.municipio} - ${im.estado}, ${formatDate(dados.data_documento)}</p>
      </div>

      <div style="display:flex; gap:20pt; margin-top:30pt;">
        <div style="flex:1;">
          <div class="doc-sig-line" style="width:100%;"></div>
          <div class="doc-sig-name">Autoridade Competente</div>
          <div class="doc-sig-role">GPRF/SEAPA</div>
        </div>
        <div style="flex:1;">
          <div class="doc-sig-line" style="width:100%;"></div>
          <div class="doc-sig-name">${rt.nome}</div>
          <div class="doc-sig-role">Profissional Designado</div>
        </div>
      </div>
    </div>`;

  return wrapHtml('13 - Ordem de Serviço', body);
}

// ── Memorial Descritivo ──

export function gerarMemorialDescritivo(dados: DadosDocumento): string {
  const { proprietario: p, imovel: im, responsavel_tecnico: rt } = dados;
  const vertices = dados.vertices || verticesFromWkt(dados.geom_wkt);
  const rings = wktToRings(dados.geom_wkt || '');
  const area = rings && rings[0] ? calculateAreaM2(rings[0]) : 0;
  const perimetro = rings && rings[0] ? calculatePerimeterM(rings[0]) : 0;
  const areaHa = area / 10000;

  // Gerar descrição textual dos limites
  let descricaoLimites = '';
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    descricaoLimites += `Do vértice <strong>${v.codigo}</strong>, de coordenadas geodésicas ${v.latitude} e ${v.longitude}, segue com azimute ${v.azimute_vante} por uma distância de ${v.distancia_vante}m até o vértice <strong>${next?.codigo || v.codigo_vante}</strong>; `;
  }

  const body = `
    ${headerSeapa()}
    <h1 style="text-align:center; font-size:14pt; margin:15pt 0;">MEMORIAL DESCRITIVO</h1>
    <div class="doc-body">
      <p class="no-indent" style="margin-bottom:15pt;"><strong>IMÓVEL:</strong> ${im.nome} ${im.gleba ? ` - Gleba ${im.gleba}` : ''}</p>
      <p class="no-indent"><strong>PROPRIETÁRIO:</strong> ${p.nome}</p>
      <p class="no-indent"><strong>CPF:</strong> ${p.cpf}</p>
      <p class="no-indent"><strong>MUNICÍPIO:</strong> ${im.municipio} - ${im.estado}</p>
      <p class="no-indent"><strong>MATRÍCULA:</strong> ${im.matricula || '________________'}</p>
      <p class="no-indent"><strong>ÁREA MEDIDA:</strong> ${areaHa.toFixed(4)} ha (${area.toFixed(2)} m²)</p>
      <p class="no-indent" style="margin-bottom:15pt;"><strong>PERÍMETRO:</strong> ${perimetro.toFixed(2)} m</p>

      <p>Inicia-se a descrição deste perímetro no vértice <strong>${vertices[0]?.codigo || 'V-01'}</strong>, definido pelas coordenadas geodésicas ${vertices[0]?.latitude || '-'} de latitude Sul e ${vertices[0]?.longitude || '-'} de longitude Oeste.</p>

      <p>${descricaoLimites}retornando ao vértice inicial, fechando assim o perímetro descrito.</p>

      <p class="no-indent" style="margin-top:15pt;"><strong>QUADRO DE COORDENADAS:</strong></p>

      ${tabelaVertices(vertices)}

      <div class="doc-local-data">
        <p class="no-indent">${im.municipio} - ${im.estado}, ${formatDate(dados.data_documento)}</p>
      </div>

      <div class="doc-sig">
        <div class="doc-sig-line"></div>
        <div class="doc-sig-name">${rt.nome}</div>
        <div class="doc-sig-role">${rt.qualificacao}</div>
        <div class="doc-sig-role">${rt.conselho_tipo}: ${rt.conselho_num}</div>
        <div class="doc-sig-role">Credenciamento INCRA: ${rt.credenciamento_incra}</div>
        ${rt.art_num ? `<div class="doc-sig-role">ART nº ${rt.art_num}</div>` : ''}
      </div>
    </div>`;

  return wrapHtml('Memorial Descritivo', body);
}

// ── Planta Topográfica ──
// Gera HTML com instruções para renderizar o mapa via canvas/imagem

export function gerarPlantaTopografica(dados: DadosDocumento, mapImageDataUrl?: string): string {
  const { proprietario: p, imovel: im, responsavel_tecnico: rt } = dados;
  const vertices = dados.vertices || verticesFromWkt(dados.geom_wkt);
  const rings = wktToRings(dados.geom_wkt || '');
  const area = rings && rings[0] ? calculateAreaM2(rings[0]) : 0;
  const perimetro = rings && rings[0] ? calculatePerimeterM(rings[0]) : 0;
  const areaHa = area / 10000;

  const mapSection = mapImageDataUrl
    ? `<img src="${mapImageDataUrl}" style="width:100%; max-height:400px; object-fit:contain; border:1px solid #000;" alt="Planta">`
    : `<div style="width:100%; height:350px; border:2px solid #000; display:flex; align-items:center; justify-content:center; background:#f8f8f8;">
        <p style="color:#666; font-size:11pt;">[Mapa será exportado do ArcGIS MapView]</p>
       </div>`;

  const body = `
    <div class="doc-header">
      <div class="org">GOVERNO DO ESTADO DE GOIÁS — SEAPA / GPRF</div>
      <h1 style="font-size:16pt; margin:10pt 0;">PLANTA TOPOGRÁFICA</h1>
    </div>

    <table class="doc-table" style="font-size:10pt; text-align:left; margin-bottom:15pt;">
      <tr>
        <td><strong>Imóvel:</strong> ${im.nome}</td>
        <td><strong>Município:</strong> ${im.municipio} - ${im.estado}</td>
      </tr>
      <tr>
        <td><strong>Proprietário:</strong> ${p.nome}</td>
        <td><strong>CPF:</strong> ${p.cpf}</td>
      </tr>
      <tr>
        <td><strong>Área:</strong> ${areaHa.toFixed(4)} ha (${area.toFixed(2)} m²)</td>
        <td><strong>Perímetro:</strong> ${perimetro.toFixed(2)} m</td>
      </tr>
      <tr>
        <td><strong>Matrícula:</strong> ${im.matricula || '____'}</td>
        <td><strong>DATUM:</strong> SIRGAS 2000 (SRID 4674)</td>
      </tr>
    </table>

    ${mapSection}

    <p style="font-size:9pt; margin-top:10pt;"><strong>QUADRO DE COORDENADAS:</strong></p>
    ${tabelaVertices(vertices)}

    <div style="display:flex; justify-content:space-between; margin-top:20pt; font-size:9pt;">
      <div>
        <p><strong>Responsável Técnico:</strong></p>
        <p>${rt.nome}</p>
        <p>${rt.qualificacao}</p>
        <p>${rt.conselho_tipo}: ${rt.conselho_num}</p>
        <p>INCRA: ${rt.credenciamento_incra}</p>
      </div>
      <div style="text-align:right;">
        <p><strong>Data:</strong> ${formatDate(dados.data_documento)}</p>
        <p><strong>Escala:</strong> indicada</p>
        <p><strong>Base cartográfica:</strong> IBGE / Esri</p>
      </div>
    </div>`;

  return wrapHtml('Planta Topográfica', body);
}

// ── Abrir documento em nova aba para impressão ──

export function abrirDocumento(html: string): void {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ── Exportar todos os geradores ──

export const DocumentGenerators = {
  requerimentoOS: gerarRequerimentoOS,
  declaracaoLimites: gerarDeclaracaoLimites,
  ordemServico: gerarOrdemServico,
  memorialDescritivo: gerarMemorialDescritivo,
  plantaTopografica: gerarPlantaTopografica,
};
