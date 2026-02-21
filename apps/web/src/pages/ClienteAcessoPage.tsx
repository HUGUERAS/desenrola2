/**
 * ClienteAcessoPage — Experiência do cliente via magic link
 * Mobile-first, sem login, sem sidebar.
 * Fluxo: Dados pessoais → Vizinhos por aresta → Confirmar e enviar
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { parseGeoFile } from '../lib/file-parsers';
import '../styles/tokens.css';

// ── Tipos ──

interface LoteAcesso {
    id: number;
    nome_cliente?: string;
    cpf_cnpj_cliente?: string;
    telefone_cliente?: string;
    email_cliente?: string;
    rg_cliente?: string;
    estado_civil_cliente?: string;
    municipio?: string;
    uf?: string;
    comarca?: string;
    codigo_sigef?: string;
    denominacao_imovel?: string;
    matricula_imovel?: string;
    geojson?: Record<string, unknown>;
    status?: string;
    token_acesso?: string;
}

interface VizinhoPorSegmento {
    segmento_index: number;
    confrontante_tipo: 'FAZENDA' | 'ESTRADA' | 'CORREGO' | 'AREA_PUBLICA' | 'OUTRO';
    nome: string;
    cpf: string;
    imovel: string;
    matricula: string;
}

type Etapa = 'loading' | 'erro' | 'dados' | 'vizinhos' | 'confirmar' | 'enviado';

type PontoSVG = { x: number; y: number };

// ── Utilitários de polígono ──

function extrairCoordenadas(geojson: Record<string, unknown> | undefined): [number, number][] {
    if (!geojson) return [];
    let coords: [number, number][] = [];

    if (geojson.type === 'FeatureCollection') {
        const features = geojson.features as Array<Record<string, unknown>>;
        if (features?.length > 0) {
            const geom = features[0].geometry as Record<string, unknown>;
            if (geom?.type === 'Polygon') {
                coords = (geom.coordinates as [number, number][][])[0];
            }
        }
    } else if (geojson.type === 'Feature') {
        const geom = geojson.geometry as Record<string, unknown>;
        if (geom?.type === 'Polygon') {
            coords = (geom.coordinates as [number, number][][])[0];
        }
    } else if (geojson.type === 'Polygon') {
        coords = (geojson.coordinates as [number, number][][])[0];
    }

    // Remove o último ponto duplicado que fecha o polígono
    if (coords.length > 1) {
        const [fx, fy] = coords[0];
        const [lx, ly] = coords[coords.length - 1];
        if (Math.abs(fx - lx) < 1e-10 && Math.abs(fy - ly) < 1e-10) {
            coords = coords.slice(0, -1);
        }
    }
    return coords;
}

function normalizarParaSVG(coords: [number, number][], w: number, h: number, pad = 24): PontoSVG[] {
    if (coords.length === 0) return [];
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const minL = Math.min(...lons), maxL = Math.max(...lons);
    const minA = Math.min(...lats), maxA = Math.max(...lats);
    const ranX = maxL - minL || 1e-6;
    const ranY = maxA - minA || 1e-6;
    const scale = Math.min((w - pad * 2) / ranX, (h - pad * 2) / ranY);
    const offX = (w - ranX * scale) / 2;
    const offY = (h - ranY * scale) / 2;
    return coords.map(([lon, lat]) => ({
        x: offX + (lon - minL) * scale,
        y: h - (offY + (lat - minA) * scale),
    }));
}

function midpoint(a: PontoSVG, b: PontoSVG): PontoSVG {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function direcaoAresta(a: [number, number], b: [number, number]): string {
    const dLon = b[0] - a[0];
    const dLat = b[1] - a[1];
    if (Math.abs(dLat) >= Math.abs(dLon)) {
        return dLat >= 0 ? 'Norte' : 'Sul';
    }
    return dLon >= 0 ? 'Leste' : 'Oeste';
}

const TIPOS_CONFRONTANTE: { value: VizinhoPorSegmento['confrontante_tipo']; label: string }[] = [
    { value: 'FAZENDA', label: 'Fazenda / Sítio' },
    { value: 'ESTRADA', label: 'Estrada / Rodovia' },
    { value: 'CORREGO', label: 'Córrego / Rio' },
    { value: 'AREA_PUBLICA', label: 'Área Pública' },
    { value: 'OUTRO', label: 'Outro' },
];

// ── Sub-componente: indicador de etapas ──

function IndicadorEtapas({ etapa }: { etapa: Etapa }) {
    const etapas = ['dados', 'vizinhos', 'confirmar'];
    const idx = etapas.indexOf(etapa);
    return (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
            {etapas.map((_, i) => (
                <div key={i} style={{
                    width: i === idx ? 24 : 8, height: 8,
                    borderRadius: 4,
                    background: i <= idx ? 'var(--color-accent)' : 'var(--color-border)',
                    transition: 'width .2s ease, background .2s ease',
                }} />
            ))}
        </div>
    );
}

// ── Sub-componente: campo de formulário ──

function Campo({ label, id, required, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; required?: boolean }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label htmlFor={id} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {label}{required && <span style={{ color: 'var(--color-error)', marginLeft: 2 }}>*</span>}
            </label>
            <input id={id} {...props} style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid var(--color-border)',
                fontSize: 15, outline: 'none',
                background: 'var(--color-bg-soft)',
                ...props.style,
            }} />
        </div>
    );
}

// ── Sub-componente: botão ──

function Btn({ variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
    return (
        <button {...props} style={{
            padding: '12px 24px', borderRadius: 8,
            border: variant === 'secondary' ? '1.5px solid var(--color-border)' : 'none',
            fontWeight: 600, fontSize: 15, cursor: 'pointer',
            background: variant === 'primary' ? 'var(--color-accent)' : 'transparent',
            color: variant === 'primary' ? '#fff' : 'var(--color-text-secondary)',
            transition: 'opacity .15s ease',
            ...props.style,
        }} />
    );
}

// ── Sub-componente: editor de polígono SVG ──

function PoligonoEditor({
    geojson,
    vizinhos,
    onEditarAresta,
}: {
    geojson: Record<string, unknown>;
    vizinhos: VizinhoPorSegmento[];
    onEditarAresta: (idx: number) => void;
}) {
    const SVG_W = 320, SVG_H = 280;
    const coords = extrairCoordenadas(geojson);
    const pts = normalizarParaSVG(coords, SVG_W, SVG_H);

    if (pts.length < 3) return (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 24 }}>
            Polígono não disponível.
        </div>
    );

    const arestas = pts.map((p, i) => ({ a: p, b: pts[(i + 1) % pts.length], idx: i }));

    return (
        <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{ display: 'block', margin: '0 auto', maxWidth: '100%', borderRadius: 12 }}>
            {/* Polígono preenchido */}
            <polygon
                points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                fill="rgba(59,130,246,.12)" stroke="none"
            />
            {/* Arestas clicáveis */}
            {arestas.map(({ a, b, idx }) => {
                const preenchido = vizinhos.some(v => v.segmento_index === idx);
                const dir = direcaoAresta(coords[idx], coords[(idx + 1) % coords.length]);
                const mid = midpoint(a, b);
                return (
                    <g key={idx} style={{ cursor: 'pointer' }} onClick={() => onEditarAresta(idx)}>
                        {/* Linha de toque ampliada (invisível) */}
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                            stroke="transparent" strokeWidth={18} />
                        {/* Linha visível */}
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                            stroke={preenchido ? '#10b981' : '#94a3b8'}
                            strokeWidth={preenchido ? 3 : 2}
                            strokeDasharray={preenchido ? undefined : '5,4'}
                        />
                        {/* Indicador de estado */}
                        <circle cx={mid.x} cy={mid.y} r={12}
                            fill={preenchido ? '#10b981' : '#fff'}
                            stroke={preenchido ? '#10b981' : '#94a3b8'}
                            strokeWidth={1.5}
                        />
                        {preenchido
                            ? <text x={mid.x} y={mid.y + 4.5} textAnchor="middle" fontSize={12} fill="#fff" fontWeight="bold">✓</text>
                            : <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight="600">{dir[0]}</text>
                        }
                    </g>
                );
            })}
            {/* Vértices */}
            {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={4} fill="#3b82f6" />
            ))}
        </svg>
    );
}

// ── Sub-componente: modal de vizinho ──

function ModalVizinho({
    arestaSelecionada,
    coords,
    vizinhos,
    onSalvar,
    onFechar,
}: {
    arestaSelecionada: number;
    coords: [number, number][];
    vizinhos: VizinhoPorSegmento[];
    onSalvar: (v: VizinhoPorSegmento) => void;
    onFechar: () => void;
}) {
    const existente = vizinhos.find(v => v.segmento_index === arestaSelecionada);
    const dir = coords.length > 0 ? direcaoAresta(coords[arestaSelecionada], coords[(arestaSelecionada + 1) % coords.length]) : '';

    const [form, setForm] = useState<VizinhoPorSegmento>(existente ?? {
        segmento_index: arestaSelecionada,
        confrontante_tipo: 'FAZENDA',
        nome: '', cpf: '', imovel: '', matricula: '',
    });

    const upd = (k: keyof VizinhoPorSegmento, v: string) => setForm(p => ({ ...p, [k]: v }));

    const precisaNome = form.confrontante_tipo !== 'AREA_PUBLICA';

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div onClick={onFechar} style={{ flex: 1, background: 'rgba(0,0,0,.4)' }} />
            <div style={{
                background: '#fff', borderRadius: '20px 20px 0 0',
                padding: '20px 20px 32px', maxHeight: '85vh', overflowY: 'auto',
            }}>
                <div style={{ width: 40, height: 4, background: 'var(--color-border)', borderRadius: 2, margin: '0 auto 16px' }} />
                <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                    Lado {arestaSelecionada + 1} — {dir}
                </p>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                    Quem é seu vizinho neste lado?
                </p>

                {/* Tipo */}
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Tipo de confrontante
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 16px' }}>
                    {TIPOS_CONFRONTANTE.map(t => (
                        <button key={t.value} onClick={() => upd('confrontante_tipo', t.value)}
                            style={{
                                padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: '1.5px solid',
                                borderColor: form.confrontante_tipo === t.value ? 'var(--color-accent)' : 'var(--color-border)',
                                background: form.confrontante_tipo === t.value ? 'var(--color-accent-soft)' : '#fff',
                                color: form.confrontante_tipo === t.value ? 'var(--color-accent)' : 'var(--color-text-default)',
                                fontWeight: form.confrontante_tipo === t.value ? 700 : 400,
                            }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {form.confrontante_tipo === 'ESTRADA' ? (
                    <Campo label="Nome da estrada / rodovia" id="imovel" value={form.imovel}
                        onChange={e => upd('imovel', e.target.value)} placeholder="Ex: GO-010, BR-153..." />
                ) : form.confrontante_tipo === 'CORREGO' ? (
                    <Campo label="Nome do córrego / rio" id="imovel" value={form.imovel}
                        onChange={e => upd('imovel', e.target.value)} placeholder="Ex: Córrego da Onça..." />
                ) : form.confrontante_tipo !== 'AREA_PUBLICA' ? (
                    <>
                        <Campo label="Nome do vizinho" id="nome" required value={form.nome}
                            onChange={e => upd('nome', e.target.value)} placeholder="Nome completo" />
                        <Campo label="CPF do vizinho" id="cpf" value={form.cpf}
                            onChange={e => upd('cpf', e.target.value)} placeholder="000.000.000-00" />
                        <Campo label="Nome do imóvel" id="imovel" value={form.imovel}
                            onChange={e => upd('imovel', e.target.value)} placeholder="Ex: Fazenda São João" />
                        <Campo label="Matrícula" id="matricula" value={form.matricula}
                            onChange={e => upd('matricula', e.target.value)} placeholder="Nº da matrícula" />
                    </>
                ) : (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16 }}>
                        Nenhum dado adicional necessário para área pública.
                    </p>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <Btn variant="secondary" onClick={onFechar} style={{ flex: 1 }}>Cancelar</Btn>
                    <Btn onClick={() => {
                        if (precisaNome && !form.nome && form.confrontante_tipo === 'FAZENDA') {
                            alert('Informe o nome do vizinho.');
                            return;
                        }
                        onSalvar(form);
                    }} style={{ flex: 2 }}>Salvar</Btn>
                </div>
            </div>
        </div>
    );
}

// ── Sub-componente: importar arquivo de coordenadas ──

function ImportarArquivo({ onImported }: { onImported: (geojson: Record<string, unknown>) => void }) {
    const [erro, setErro] = useState<string | null>(null);
    const [sucesso, setSucesso] = useState(false);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setErro(null);
        setSucesso(false);
        const result = await parseGeoFile(file);
        if (result && typeof result === 'object') {
            onImported(result as Record<string, unknown>);
            setSucesso(true);
        } else {
            setErro('Não foi possível extrair coordenadas. Verifique o formato do arquivo.');
        }
        // Limpa o input para permitir reimport do mesmo arquivo
        e.target.value = '';
    };

    return (
        <div style={{
            background: '#f0f9ff', borderRadius: 12, padding: 16, marginBottom: 16,
            border: '1.5px dashed #93c5fd',
        }}>
            <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>
                Importar limites do imóvel
            </p>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
                CSV · DXF · GeoJSON · KML
            </p>
            {sucesso ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Arquivo importado!</span>
                    <label style={{ fontSize: 12, color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}>
                        Trocar
                        <input type="file" accept=".csv,.txt,.dxf,.geojson,.json,.kml,.kmz" onChange={handleFile} style={{ display: 'none' }} />
                    </label>
                </div>
            ) : (
                <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '9px 16px', background: '#3b82f6', color: '#fff',
                    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>
                    ↑ Selecionar arquivo
                    <input type="file" accept=".csv,.txt,.dxf,.geojson,.json,.kml,.kmz" onChange={handleFile} style={{ display: 'none' }} />
                </label>
            )}
            {erro && (
                <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{erro}</p>
            )}
        </div>
    );
}

// ── Página principal ──

export default function ClienteAcessoPage() {
    const { token } = useParams<{ token: string }>();
    const [etapa, setEtapa] = useState<Etapa>('loading');
    const [lote, setLote] = useState<LoteAcesso | null>(null);
    const [erroMsg, setErroMsg] = useState('');
    const [salvando, setSalvando] = useState(false);

    const [dados, setDados] = useState({
        nome_cliente: '', cpf_cnpj_cliente: '', telefone_cliente: '', email_cliente: '',
        rg_cliente: '', estado_civil_cliente: '', municipio: '', uf: 'GO',
        comarca: '', matricula_imovel: '', denominacao_imovel: '', codigo_sigef: '',
    });

    const [vizinhos, setVizinhos] = useState<VizinhoPorSegmento[]>([]);
    const [arestaSelecionada, setArestaSelecionada] = useState<number | null>(null);
    const [geojsonCliente, setGeojsonCliente] = useState<Record<string, unknown> | null>(null);

    const efetivGeoJSON = geojsonCliente ?? lote?.geojson;
    const coords = extrairCoordenadas(efetivGeoJSON);
    const temPoligono = coords.length >= 3;
    const totalArestas = temPoligono ? coords.length : 4;
    const direcoes = ['Norte', 'Sul', 'Leste', 'Oeste'];

    // Carregar lote pelo token
    useEffect(() => {
        if (!token) { setErroMsg('Token inválido.'); setEtapa('erro'); return; }
        const apiUrl = import.meta.env.VITE_API_URL ?? '';
        fetch(`${apiUrl}/api/acesso-lote?token=${encodeURIComponent(token)}`)
            .then(r => { if (!r.ok) throw new Error('Link inválido ou expirado.'); return r.json(); })
            .then((data: LoteAcesso) => {
                setLote(data);
                setDados(d => ({
                    ...d,
                    nome_cliente: data.nome_cliente ?? '',
                    cpf_cnpj_cliente: data.cpf_cnpj_cliente ?? '',
                    telefone_cliente: data.telefone_cliente ?? '',
                    email_cliente: data.email_cliente ?? '',
                    rg_cliente: data.rg_cliente ?? '',
                    estado_civil_cliente: data.estado_civil_cliente ?? '',
                    municipio: data.municipio ?? '',
                    uf: data.uf ?? 'GO',
                    comarca: data.comarca ?? '',
                    matricula_imovel: data.matricula_imovel ?? '',
                    denominacao_imovel: data.denominacao_imovel ?? '',
                    codigo_sigef: data.codigo_sigef ?? '',
                }));
                setEtapa('dados');
            })
            .catch(e => { setErroMsg(e.message); setEtapa('erro'); });
    }, [token]);

    const updDados = (k: keyof typeof dados, v: string) => setDados(p => ({ ...p, [k]: v }));

    const salvarVizinho = (v: VizinhoPorSegmento) => {
        setVizinhos(prev => {
            const sem = prev.filter(x => x.segmento_index !== v.segmento_index);
            return [...sem, v];
        });
        setArestaSelecionada(null);
    };

    const tipoVizinhoDir = (idx: number): VizinhoPorSegmento => (
        vizinhos.find(v => v.segmento_index === idx) ?? {
            segmento_index: idx, confrontante_tipo: 'FAZENDA', nome: '', cpf: '', imovel: '', matricula: '',
        }
    );

    const enviar = async () => {
        if (!token) return;
        setSalvando(true);
        const apiUrl = import.meta.env.VITE_API_URL ?? '';
        try {
            const res = await fetch(`${apiUrl}/api/acesso-lote/salvar?token=${encodeURIComponent(token)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...dados,
                    vizinhos,
                    ...(geojsonCliente ? { geojson: geojsonCliente } : {}),
                }),
            });
            if (!res.ok) throw new Error('Erro ao enviar dados.');
            setEtapa('enviado');
        } catch (e: unknown) {
            alert((e as Error).message);
        } finally {
            setSalvando(false);
        }
    };

    // ── Layouts ──

    const shell = (children: React.ReactNode) => (
        <div style={{
            minHeight: '100dvh', background: 'var(--color-bg-soft)',
            fontFamily: 'var(--font-sans)', color: 'var(--color-text-default)',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Header mínimo */}
            <div style={{
                background: '#fff', padding: '14px 20px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', gap: 10,
            }}>
                <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'linear-gradient(135deg, var(--auth-brand-1), var(--auth-brand-2))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: 14,
                }}>D</div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Desenrola</span>
            </div>
            <div style={{ flex: 1, padding: '24px 20px', maxWidth: 480, width: '100%', margin: '0 auto' }}>
                {children}
            </div>
        </div>
    );

    if (etapa === 'loading') return shell(
        <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--color-text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p>Carregando seu link...</p>
        </div>
    );

    if (etapa === 'erro') return shell(
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>Link inválido</p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>{erroMsg}</p>
        </div>
    );

    if (etapa === 'enviado') return shell(
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Dados enviados!</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                Obrigado, <strong>{dados.nome_cliente || 'proprietário'}</strong>.
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                Seus dados foram recebidos pelo topógrafo. Você será notificado quando o documento estiver pronto.
            </p>
        </div>
    );

    // ── Etapa 1: Dados pessoais ──

    if (etapa === 'dados') return shell(<>
        <IndicadorEtapas etapa="dados" />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Seus dados</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>
            Preencha seus dados pessoais e do imóvel.
        </p>

        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>Dados pessoais</p>
        <Campo label="Nome completo" id="nome" required value={dados.nome_cliente} onChange={e => updDados('nome_cliente', e.target.value)} placeholder="Fulano de Tal" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo label="CPF" id="cpf" required value={dados.cpf_cnpj_cliente} onChange={e => updDados('cpf_cnpj_cliente', e.target.value)} placeholder="000.000.000-00" />
            <Campo label="RG" id="rg" value={dados.rg_cliente} onChange={e => updDados('rg_cliente', e.target.value)} placeholder="0000000" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo label="Telefone" id="tel" value={dados.telefone_cliente} onChange={e => updDados('telefone_cliente', e.target.value)} placeholder="(62) 99999-9999" />
            <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Estado civil</label>
                <select value={dados.estado_civil_cliente} onChange={e => updDados('estado_civil_cliente', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 15, background: 'var(--color-bg-soft)' }}>
                    <option value="">—</option>
                    {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'].map(v => (
                        <option key={v} value={v}>{v}</option>
                    ))}
                </select>
            </div>
        </div>
        <Campo label="E-mail" id="email" type="email" value={dados.email_cliente} onChange={e => updDados('email_cliente', e.target.value)} placeholder="email@exemplo.com" />

        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '.06em', textTransform: 'uppercase', margin: '20px 0 12px' }}>Dados do imóvel</p>
        <Campo label="Denominação / nome da propriedade" id="den" value={dados.denominacao_imovel} onChange={e => updDados('denominacao_imovel', e.target.value)} placeholder="Ex: Fazenda São João" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Campo label="Município" id="mun" required value={dados.municipio} onChange={e => updDados('municipio', e.target.value)} placeholder="Ex: Niquelândia" />
            <Campo label="UF" id="uf" value={dados.uf} onChange={e => updDados('uf', e.target.value)} placeholder="GO" maxLength={2} />
        </div>
        <Campo label="Comarca" id="comarca" value={dados.comarca} onChange={e => updDados('comarca', e.target.value)} placeholder="Ex: Niquelândia" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo label="Matrícula" id="mat" value={dados.matricula_imovel} onChange={e => updDados('matricula_imovel', e.target.value)} placeholder="0.000" />
            <Campo label="Código SIGEF" id="sigef" value={dados.codigo_sigef} onChange={e => updDados('codigo_sigef', e.target.value)} placeholder="Opcional" />
        </div>

        <Btn onClick={() => {
            if (!dados.nome_cliente || !dados.cpf_cnpj_cliente) { alert('Preencha nome e CPF.'); return; }
            setEtapa('vizinhos');
        }} style={{ width: '100%', marginTop: 8 }}>
            Próximo →
        </Btn>
    </>);

    // ── Etapa 2: Vizinhos ──

    if (etapa === 'vizinhos') return shell(<>
        <IndicadorEtapas etapa="vizinhos" />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Seus vizinhos</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 20 }}>
            {temPoligono
                ? 'Toque em cada lado do seu terreno para informar o vizinho.'
                : 'Informe o vizinho de cada lado do seu imóvel.'}
        </p>

        {temPoligono ? (
            <>
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: 'var(--app-shadow-sm)', marginBottom: 20 }}>
                    <PoligonoEditor
                        geojson={efetivGeoJSON!}
                        vizinhos={vizinhos}
                        onEditarAresta={setArestaSelecionada}
                    />
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: 4 }}>
                    {vizinhos.length}/{totalArestas} lados preenchidos
                </p>
                {/* Permite substituir polígono por import mesmo quando já existe um */}
                <ImportarArquivo onImported={setGeojsonCliente} />
            </>
        ) : (
            // Sem polígono: import primeiro, depois direções cardinais
            <>
                <ImportarArquivo onImported={setGeojsonCliente} />
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                    {[0, 1, 2, 3].map(idx => {
                        const v = tipoVizinhoDir(idx);
                        const preenchido = vizinhos.some(x => x.segmento_index === idx);
                        return (
                            <div key={idx} onClick={() => setArestaSelecionada(idx)}
                                style={{
                                    padding: '14px 16px', borderRadius: 10, marginBottom: 8,
                                    border: '1.5px solid', cursor: 'pointer',
                                    borderColor: preenchido ? 'var(--color-success)' : 'var(--color-border)',
                                    background: preenchido ? '#f0fdf4' : 'var(--color-bg-soft)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                }}>
                                <div>
                                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{direcoes[idx]}</p>
                                    {preenchido && (
                                        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                                            {v.nome || v.imovel || TIPOS_CONFRONTANTE.find(t => t.value === v.confrontante_tipo)?.label}
                                        </p>
                                    )}
                                </div>
                                <span style={{ fontSize: 18 }}>{preenchido ? '✓' : '+'}</span>
                            </div>
                        );
                    })}
                </div>
            </>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
            <Btn variant="secondary" onClick={() => setEtapa('dados')} style={{ flex: 1 }}>← Voltar</Btn>
            <Btn onClick={() => setEtapa('confirmar')} style={{ flex: 2 }}>Próximo →</Btn>
        </div>

        {arestaSelecionada !== null && (
            <ModalVizinho
                arestaSelecionada={arestaSelecionada}
                coords={temPoligono ? coords : [[0, 0], [1, 0], [1, 1], [0, 1]]}
                vizinhos={vizinhos}
                onSalvar={salvarVizinho}
                onFechar={() => setArestaSelecionada(null)}
            />
        )}
    </>);

    // ── Etapa 3: Confirmar ──

    return shell(<>
        <IndicadorEtapas etapa="confirmar" />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Confirmar e enviar</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>
            Verifique as informações antes de enviar.
        </p>

        {[
            { icon: '👤', label: 'Proprietário', valor: dados.nome_cliente },
            { icon: '📋', label: 'CPF', valor: dados.cpf_cnpj_cliente },
            { icon: '🏘️', label: 'Imóvel', valor: dados.denominacao_imovel || '—' },
            { icon: '📍', label: 'Município / UF', valor: `${dados.municipio} / ${dados.uf}` },
            { icon: '🧭', label: 'Vizinhos identificados', valor: `${vizinhos.length} de ${totalArestas}` },
        ].map(({ icon, label, valor }) => (
            <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', borderBottom: '1px solid var(--color-border)',
            }}>
                <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{icon}</span>
                <div>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{valor}</p>
                </div>
            </div>
        ))}

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <Btn variant="secondary" onClick={() => setEtapa('vizinhos')} style={{ flex: 1 }}>← Voltar</Btn>
            <Btn onClick={enviar} disabled={salvando} style={{ flex: 2, opacity: salvando ? .6 : 1 }}>
                {salvando ? 'Enviando...' : 'Enviar dados'}
            </Btn>
        </div>
    </>);
}
