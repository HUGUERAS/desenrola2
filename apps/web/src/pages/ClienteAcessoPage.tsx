/**
 * ClienteAcessoPage — Experiência do cliente via magic link
 * Mobile-first, sem login, sem sidebar.
 * Fluxo: Dados pessoais → Vizinhos por aresta → Confirmar e enviar
 *
 * Features:
 * - OCR: preencher campos com foto de documento (Tesseract.js)
 * - Multi-segmento: agrupar múltiplas arestas ao mesmo vizinho
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { parseGeoFile } from '../lib/file-parsers';
import { formatCPFCNPJ, formatPhone } from '../lib/format-utils';
import type { ExtractedFields } from '../lib/ocr-extractor';
import apiClient from '../services/api';
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

interface VizinhoGrupo {
    segmento_indices: number[];
    confrontante_tipo: 'FAZENDA' | 'ESTRADA' | 'CORREGO' | 'AREA_PUBLICA' | 'OUTRO';
    nome: string;
    cpf: string;
    imovel: string;
    matricula: string;
}

type Etapa = 'loading' | 'erro' | 'dados' | 'vizinhos' | 'confirmar' | 'enviado';

type PontoSVG = { x: number; y: number };

// ── Paleta de cores por grupo ──

const CORES_GRUPO = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16',
];

// ── Conversão grupo ↔ flat ──

function gruposParaVizinhos(grupos: VizinhoGrupo[]): VizinhoPorSegmento[] {
    return grupos.flatMap(g =>
        g.segmento_indices.map(idx => ({
            segmento_index: idx,
            confrontante_tipo: g.confrontante_tipo,
            nome: g.nome,
            cpf: g.cpf,
            imovel: g.imovel,
            matricula: g.matricula,
        }))
    );
}

function vizinhosParaGrupos(vizinhos: VizinhoPorSegmento[]): VizinhoGrupo[] {
    const map = new Map<string, VizinhoGrupo>();
    for (const v of vizinhos) {
        const key = `${v.confrontante_tipo}|${v.nome}|${v.cpf}|${v.imovel}|${v.matricula}`;
        const existing = map.get(key);
        if (existing) {
            existing.segmento_indices.push(v.segmento_index);
        } else {
            map.set(key, {
                segmento_indices: [v.segmento_index],
                confrontante_tipo: v.confrontante_tipo,
                nome: v.nome,
                cpf: v.cpf,
                imovel: v.imovel,
                matricula: v.matricula,
            });
        }
    }
    return Array.from(map.values());
}

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

// ── Sub-componente: OCR de documento ──

function DocumentoOCR({ onFieldsExtracted }: {
    onFieldsExtracted: (fields: ExtractedFields) => void;
}) {
    const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
    const [progress, setProgress] = useState(0);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setStatus('processing');
        setProgress(0);
        try {
            const { extractTextFromImage, extractTextFromPDF, parseFieldsFromText } = await import('../lib/ocr-extractor');
            const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            const text = isPDF
                ? await extractTextFromPDF(file, setProgress)
                : await extractTextFromImage(file, setProgress);
            const fields = parseFieldsFromText(text);
            const hasFields = Object.values(fields).some(v => v);
            if (hasFields) {
                onFieldsExtracted(fields);
                setStatus('done');
            } else {
                setStatus('error');
            }
        } catch {
            setStatus('error');
        }
        e.target.value = '';
    };

    return (
        <div style={{
            background: status === 'done' ? '#f0fdf4' : '#f0f9ff',
            borderRadius: 12, padding: 16, marginBottom: 20,
            border: `1.5px dashed ${status === 'done' ? '#86efac' : status === 'error' ? '#fca5a5' : '#93c5fd'}`,
        }}>
            <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>
                Preencher com foto ou PDF de documento
            </p>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
                Envie foto ou PDF de sua escritura, RG ou CPF para preencher automaticamente
            </p>

            {status === 'processing' ? (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{
                            flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden',
                        }}>
                            <div style={{
                                width: `${progress}%`, height: '100%',
                                background: '#3b82f6', borderRadius: 3,
                                transition: 'width .3s ease',
                            }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#64748b', minWidth: 36 }}>{progress}%</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Lendo documento...</p>
                </div>
            ) : status === 'done' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>Campos preenchidos</span>
                    <label style={{ fontSize: 12, color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}>
                        Enviar outro
                        <input type="file" accept="image/jpeg,image/png,image/jpg,application/pdf,.pdf" onChange={handleFile} style={{ display: 'none' }} />
                    </label>
                </div>
            ) : status === 'error' ? (
                <div>
                    <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 8px' }}>
                        Nenhum dado encontrado. Tente outro arquivo com melhor qualidade.
                    </p>
                    <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 14px', background: '#3b82f6', color: '#fff',
                        borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    }}>
                        Tentar novamente
                        <input type="file" accept="image/jpeg,image/png,image/jpg,application/pdf,.pdf" onChange={handleFile} style={{ display: 'none' }} />
                    </label>
                </div>
            ) : (
                <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '9px 16px', background: '#3b82f6', color: '#fff',
                    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>
                    Enviar foto ou PDF
                    <input type="file" accept="image/jpeg,image/png,image/jpg,application/pdf,.pdf" onChange={handleFile} style={{ display: 'none' }} />
                </label>
            )}
        </div>
    );
}

// ── Sub-componente: modal de confirmação OCR ──

function ModalOCRConfirm({ fields, onConfirm, onCancel }: {
    fields: ExtractedFields;
    onConfirm: (selected: ExtractedFields) => void;
    onCancel: () => void;
}) {
    const entries = Object.entries(fields).filter(([, v]) => v) as [keyof ExtractedFields, string][];
    const [checked, setChecked] = useState<Record<string, boolean>>(
        Object.fromEntries(entries.map(([k]) => [k, true]))
    );

    const labels: Record<string, string> = {
        nome_cliente: 'Nome',
        cpf_cnpj_cliente: 'CPF / CNPJ',
        rg_cliente: 'RG',
        municipio: 'Município',
        uf: 'UF',
        matricula_imovel: 'Matrícula',
        denominacao_imovel: 'Imóvel',
        estado_civil_cliente: 'Estado civil',
    };

    const handleConfirm = () => {
        const selected: ExtractedFields = {};
        for (const [k, v] of entries) {
            if (checked[k]) {
                (selected as Record<string, string>)[k] = v;
            }
        }
        onConfirm(selected);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div onClick={onCancel} style={{ flex: 1, background: 'rgba(0,0,0,.4)' }} />
            <div style={{
                background: '#fff', borderRadius: '20px 20px 0 0',
                padding: '20px 20px 32px', maxHeight: '85vh', overflowY: 'auto',
            }}>
                <div style={{ width: 40, height: 4, background: 'var(--color-border)', borderRadius: 2, margin: '0 auto 16px' }} />
                <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Dados encontrados</p>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                    Desmarque o que estiver incorreto.
                </p>

                {entries.map(([k, v]) => (
                    <label key={k} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 0', borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer',
                    }}>
                        <input type="checkbox" checked={checked[k] ?? false}
                            onChange={() => setChecked(p => ({ ...p, [k]: !p[k] }))}
                            style={{ width: 18, height: 18, accentColor: 'var(--color-accent)' }}
                        />
                        <div>
                            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0, textTransform: 'uppercase' }}>
                                {labels[k] || k}
                            </p>
                            <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{v}</p>
                        </div>
                    </label>
                ))}

                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    <Btn variant="secondary" onClick={onCancel} style={{ flex: 1 }}>Cancelar</Btn>
                    <Btn onClick={handleConfirm} style={{ flex: 2 }}>Preencher campos</Btn>
                </div>
            </div>
        </div>
    );
}

// ── Sub-componente: editor de polígono SVG (multi-seleção) ──

function PoligonoEditor({
    geojson,
    grupos,
    arestasSelecionadas,
    onToggleAresta,
    onEditarGrupo,
}: {
    geojson: Record<string, unknown>;
    grupos: VizinhoGrupo[];
    arestasSelecionadas: number[];
    onToggleAresta: (idx: number) => void;
    onEditarGrupo: (indices: number[]) => void;
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

    // Mapeia aresta → grupo
    const arestaGrupoMap = new Map<number, number>();
    grupos.forEach((g, gi) => {
        g.segmento_indices.forEach(idx => arestaGrupoMap.set(idx, gi));
    });

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
                const grupoIdx = arestaGrupoMap.get(idx);
                const preenchido = grupoIdx !== undefined;
                const selecionada = arestasSelecionadas.includes(idx);
                const cor = preenchido ? CORES_GRUPO[grupoIdx % CORES_GRUPO.length] : '#94a3b8';
                const dir = direcaoAresta(coords[idx], coords[(idx + 1) % coords.length]);
                const mid = midpoint(a, b);

                const handleClick = () => {
                    if (preenchido) {
                        // Clicar em aresta preenchida → abrir grupo para editar
                        const grp = grupos[grupoIdx];
                        onEditarGrupo(grp.segmento_indices);
                    } else {
                        // Toggle seleção
                        onToggleAresta(idx);
                    }
                };

                return (
                    <g key={idx} style={{ cursor: 'pointer' }} onClick={handleClick}>
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                            stroke="transparent" strokeWidth={18} />
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                            stroke={selecionada ? '#3b82f6' : cor}
                            strokeWidth={selecionada ? 4 : preenchido ? 3 : 2}
                            strokeDasharray={preenchido ? undefined : selecionada ? '6,3' : '5,4'}
                        />
                        <circle cx={mid.x} cy={mid.y} r={12}
                            fill={selecionada ? '#3b82f6' : preenchido ? cor : '#fff'}
                            stroke={selecionada ? '#3b82f6' : preenchido ? cor : '#94a3b8'}
                            strokeWidth={1.5}
                        />
                        {preenchido
                            ? <text x={mid.x} y={mid.y + 4.5} textAnchor="middle" fontSize={12} fill="#fff" fontWeight="bold">
                                {String(grupoIdx! + 1)}
                              </text>
                            : selecionada
                                ? <text x={mid.x} y={mid.y + 4.5} textAnchor="middle" fontSize={11} fill="#fff" fontWeight="bold">+</text>
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

// ── Sub-componente: legenda de grupos ──

function LegendaGrupos({ grupos }: { grupos: VizinhoGrupo[] }) {
    if (grupos.length === 0) return null;
    return (
        <div style={{ marginTop: 12, marginBottom: 8 }}>
            {grupos.map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{
                        width: 12, height: 12, borderRadius: 3,
                        background: CORES_GRUPO[i % CORES_GRUPO.length],
                    }} />
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {g.nome || g.imovel || TIPOS_CONFRONTANTE.find(t => t.value === g.confrontante_tipo)?.label || 'Vizinho'}
                        {' '}(lados {g.segmento_indices.map(s => s + 1).join(', ')})
                    </span>
                </div>
            ))}
        </div>
    );
}

// ── Sub-componente: modal de vizinho (multi-segmento) ──

function ModalVizinho({
    arestasSelecionadas,
    coords,
    grupos,
    onSalvar,
    onFechar,
}: {
    arestasSelecionadas: number[];
    coords: [number, number][];
    grupos: VizinhoGrupo[];
    onSalvar: (v: VizinhoGrupo) => void;
    onFechar: () => void;
}) {
    // Verifica se estamos editando um grupo existente
    const existente = grupos.find(g =>
        arestasSelecionadas.every(idx => g.segmento_indices.includes(idx))
    );

    const direcoes = arestasSelecionadas.map(idx => {
        if (coords.length > 0) return direcaoAresta(coords[idx], coords[(idx + 1) % coords.length]);
        return '';
    });
    const dirsUnicas = [...new Set(direcoes)].join('/');
    const ladosLabel = arestasSelecionadas.length === 1
        ? `Lado ${arestasSelecionadas[0] + 1}`
        : `Lados ${arestasSelecionadas.map(i => i + 1).join(', ')}`;

    const [form, setForm] = useState<VizinhoGrupo>(existente ?? {
        segmento_indices: arestasSelecionadas,
        confrontante_tipo: 'FAZENDA',
        nome: '', cpf: '', imovel: '', matricula: '',
    });
    const [erro, setErro] = useState('');

    const upd = (k: keyof VizinhoGrupo, v: string) => setForm(p => ({ ...p, [k]: v }));

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
                    {ladosLabel} — {dirsUnicas}
                </p>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                    {arestasSelecionadas.length > 1
                        ? 'Quem é seu vizinho nestes lados?'
                        : 'Quem é seu vizinho neste lado?'}
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
                            setErro('Informe o nome do vizinho.');
                            return;
                        }
                        setErro('');
                        onSalvar({ ...form, segmento_indices: arestasSelecionadas });
                    }} style={{ flex: 2 }}>Salvar</Btn>
                </div>
                {erro && (
                    <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 10 }}>{erro}</p>
                )}
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
                    <span style={{ color: '#10b981', fontWeight: 700 }}>Arquivo importado!</span>
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
                    Selecionar arquivo
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
    const [formError, setFormError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [salvando, setSalvando] = useState(false);

    const [dados, setDados] = useState({
        nome_cliente: '', cpf_cnpj_cliente: '', telefone_cliente: '', email_cliente: '',
        rg_cliente: '', estado_civil_cliente: '', municipio: '', uf: 'GO',
        comarca: '', matricula_imovel: '', denominacao_imovel: '', codigo_sigef: '',
    });

    // Multi-segmento: state de grupos
    const [vizinhoGrupos, setVizinhoGrupos] = useState<VizinhoGrupo[]>([]);
    const [arestasSelecionadas, setArestasSelecionadas] = useState<number[]>([]);
    const [editandoGrupo, setEditandoGrupo] = useState(false);
    const [geojsonCliente, setGeojsonCliente] = useState<Record<string, unknown> | null>(null);

    // OCR state
    const [ocrFields, setOcrFields] = useState<ExtractedFields | null>(null);

    // Derivado: flat vizinhos para API (sem mudança no enviar)
    const vizinhos = useMemo(() => gruposParaVizinhos(vizinhoGrupos), [vizinhoGrupos]);

    const efetivGeoJSON = geojsonCliente ?? lote?.geojson;
    const coords = extrairCoordenadas(efetivGeoJSON);
    const temPoligono = coords.length >= 3;
    const totalArestas = temPoligono ? coords.length : 4;
    const direcoes = ['Norte', 'Sul', 'Leste', 'Oeste'];

    // Contar segmentos preenchidos
    const segmentosPreenchidos = new Set(vizinhoGrupos.flatMap(g => g.segmento_indices)).size;

    // Carregar lote pelo token
    useEffect(() => {
        if (!token) { setErroMsg('Token inválido.'); setEtapa('erro'); return; }
        apiClient.getLotePorToken(token)
            .then((res) => {
                if (res.error || !res.data) throw new Error(res.error || 'Link inválido ou expirado.');
                const data = res.data as LoteAcesso;
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

    // OCR: aplicar campos confirmados
    const applyOcrFields = (fields: ExtractedFields) => {
        setDados(prev => {
            const next = { ...prev };
            for (const [key, val] of Object.entries(fields)) {
                if (val && key in next) {
                    (next as Record<string, string>)[key] = val;
                }
            }
            return next;
        });
        setOcrFields(null);
    };

    // Multi-segmento: salvar grupo
    const salvarVizinhoGrupo = (grupo: VizinhoGrupo) => {
        setVizinhoGrupos(prev => {
            const noOverlap = prev.filter(g =>
                !g.segmento_indices.some(idx => grupo.segmento_indices.includes(idx))
            );
            return [...noOverlap, grupo];
        });
        setArestasSelecionadas([]);
        setEditandoGrupo(false);
    };

    // Toggle seleção de aresta
    const toggleAresta = (idx: number) => {
        setArestasSelecionadas(prev =>
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        );
    };

    // Abrir modal para editar grupo existente
    const editarGrupoExistente = (indices: number[]) => {
        setArestasSelecionadas(indices);
        setEditandoGrupo(true);
    };

    // Fallback: salvar vizinho por direção (sem polígono)
    const salvarVizinhoDir = (v: VizinhoGrupo) => {
        setVizinhoGrupos(prev => {
            const noOverlap = prev.filter(g =>
                !g.segmento_indices.some(idx => v.segmento_indices.includes(idx))
            );
            return [...noOverlap, v];
        });
        setArestasSelecionadas([]);
        setEditandoGrupo(false);
    };

    const tipoVizinhoDir = (idx: number): VizinhoGrupo | undefined =>
        vizinhoGrupos.find(g => g.segmento_indices.includes(idx));

    const enviar = async () => {
        if (!token) return;
        setSalvando(true);
        setSubmitError('');
        try {
            const res = await apiClient.salvarAcessoLote(token, {
                ...dados,
                vizinhos,
                ...(geojsonCliente ? { geojson: geojsonCliente } : {}),
            });
            if (res.error) throw new Error(res.error);
            setEtapa('enviado');
        } catch (e: unknown) {
            setSubmitError((e as Error).message || 'Erro ao enviar dados.');
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
            <div style={{ fontSize: 32, marginBottom: 12 }}>...</div>
            <p>Carregando seu link...</p>
        </div>
    );

    if (etapa === 'erro') return shell(
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>!</div>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>Link inválido</p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>{erroMsg}</p>
        </div>
    );

    if (etapa === 'enviado') return shell(
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16, color: '#10b981' }}>OK</div>
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

        {/* OCR */}
        <DocumentoOCR onFieldsExtracted={(fields) => setOcrFields(fields)} />
        {ocrFields && (
            <ModalOCRConfirm
                fields={ocrFields}
                onConfirm={applyOcrFields}
                onCancel={() => setOcrFields(null)}
            />
        )}

        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>Dados pessoais</p>
        <Campo label="Nome completo" id="nome" required value={dados.nome_cliente} onChange={e => updDados('nome_cliente', e.target.value)} placeholder="Fulano de Tal" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo label="CPF / CNPJ" id="cpf" required value={dados.cpf_cnpj_cliente} onChange={e => updDados('cpf_cnpj_cliente', formatCPFCNPJ(e.target.value))} placeholder="000.000.000-00" />
            <Campo label="RG" id="rg" value={dados.rg_cliente} onChange={e => updDados('rg_cliente', e.target.value)} placeholder="0000000" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo label="Telefone" id="tel" value={dados.telefone_cliente} onChange={e => updDados('telefone_cliente', formatPhone(e.target.value))} placeholder="(62) 99999-9999" />
            <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Estado civil</label>
                <select value={dados.estado_civil_cliente} onChange={e => updDados('estado_civil_cliente', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 15, background: 'var(--color-bg-soft)' }}>
                    <option value="">--</option>
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
            if (!dados.nome_cliente || !dados.cpf_cnpj_cliente) {
                setFormError('Preencha nome e CPF para continuar.');
                return;
            }
            setFormError('');
            setEtapa('vizinhos');
        }} style={{ width: '100%', marginTop: 8 }}>
            Próximo
        </Btn>
        {formError && (
            <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 10 }}>{formError}</p>
        )}
    </>);

    // ── Etapa 2: Vizinhos ──

    if (etapa === 'vizinhos') return shell(<>
        <IndicadorEtapas etapa="vizinhos" />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Seus vizinhos</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 20 }}>
            {temPoligono
                ? 'Toque nos lados do terreno para informar os vizinhos. Selecione vários lados para o mesmo vizinho.'
                : 'Informe o vizinho de cada lado do seu imóvel.'}
        </p>

        {temPoligono ? (
            <>
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: 'var(--app-shadow-sm)', marginBottom: 12 }}>
                    <PoligonoEditor
                        geojson={efetivGeoJSON!}
                        grupos={vizinhoGrupos}
                        arestasSelecionadas={arestasSelecionadas}
                        onToggleAresta={toggleAresta}
                        onEditarGrupo={editarGrupoExistente}
                    />
                </div>

                {/* Barra de seleção */}
                {arestasSelecionadas.length > 0 && !editandoGrupo && (
                    <div style={{
                        background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: 12,
                        padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <span style={{ fontSize: 13, color: '#1e40af', fontWeight: 600 }}>
                            {arestasSelecionadas.length} {arestasSelecionadas.length === 1 ? 'lado selecionado' : 'lados selecionados'}
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setArestasSelecionadas([])}
                                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #93c5fd', background: '#fff', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                Limpar
                            </button>
                            <button onClick={() => setEditandoGrupo(true)}
                                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                Informar vizinho
                            </button>
                        </div>
                    </div>
                )}

                <LegendaGrupos grupos={vizinhoGrupos} />

                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: 4 }}>
                    {segmentosPreenchidos}/{totalArestas} lados preenchidos
                </p>
                <ImportarArquivo onImported={setGeojsonCliente} />
            </>
        ) : (
            <>
                <ImportarArquivo onImported={setGeojsonCliente} />
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                    {[0, 1, 2, 3].map(idx => {
                        const grupo = tipoVizinhoDir(idx);
                        const preenchido = !!grupo;
                        return (
                            <div key={idx} onClick={() => { setArestasSelecionadas([idx]); setEditandoGrupo(true); }}
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
                                            {grupo.nome || grupo.imovel || TIPOS_CONFRONTANTE.find(t => t.value === grupo.confrontante_tipo)?.label}
                                        </p>
                                    )}
                                </div>
                                <span style={{ fontSize: 18, color: preenchido ? '#10b981' : '#94a3b8' }}>{preenchido ? '+' : '+'}</span>
                            </div>
                        );
                    })}
                </div>
            </>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
            <Btn variant="secondary" onClick={() => setEtapa('dados')} style={{ flex: 1 }}>Voltar</Btn>
            <Btn onClick={() => setEtapa('confirmar')} style={{ flex: 2 }}>Próximo</Btn>
        </div>

        {editandoGrupo && arestasSelecionadas.length > 0 && (
            <ModalVizinho
                arestasSelecionadas={arestasSelecionadas}
                coords={temPoligono ? coords : [[0, 0], [1, 0], [1, 1], [0, 1]]}
                grupos={vizinhoGrupos}
                onSalvar={temPoligono ? salvarVizinhoGrupo : salvarVizinhoDir}
                onFechar={() => { setArestasSelecionadas([]); setEditandoGrupo(false); }}
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
            { label: 'Proprietário', valor: dados.nome_cliente },
            { label: 'CPF', valor: dados.cpf_cnpj_cliente },
            { label: 'Imóvel', valor: dados.denominacao_imovel || '--' },
            { label: 'Município / UF', valor: `${dados.municipio} / ${dados.uf}` },
            { label: 'Vizinhos', valor: `${vizinhoGrupos.length} vizinhos em ${segmentosPreenchidos} de ${totalArestas} lados` },
        ].map(({ label, valor }) => (
            <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', borderBottom: '1px solid var(--color-border)',
            }}>
                <div>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{valor}</p>
                </div>
            </div>
        ))}

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <Btn variant="secondary" onClick={() => setEtapa('vizinhos')} style={{ flex: 1 }}>Voltar</Btn>
            <Btn onClick={enviar} disabled={salvando} style={{ flex: 2, opacity: salvando ? .6 : 1 }}>
                {salvando ? 'Enviando...' : 'Enviar dados'}
            </Btn>
        </div>
        {submitError && (
            <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 10 }}>{submitError}</p>
        )}
    </>);
}
