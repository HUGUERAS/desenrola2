/**
 * VizinhosPanel — Identificar vizinhos automáticos + edição manual + DirectionCompass
 * Integração Carretel: rosa dos ventos, adicionar vizinho por direção, editar dados
 */
import { useState } from 'react';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { Search, Save, Loader2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Pencil, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import DirectionCompass from '../DirectionCompass';
import { formatCPF } from '../../lib/format-utils';

interface Vizinho {
    lote_id: string;
    numero: number;
    direcao: string;
    cliente: { nome: string; cpf?: string } | null;
    azimute_graus?: number;
    distancia_metros?: number;
}

interface ResultadoVizinhos {
    vizinhos: Vizinho[];
    vizinhos_por_direcao: Record<string, Vizinho[]>;
    total_vizinhos: number;
    metadados?: { tempo_execucao_ms?: number };
}

const DIRECOES = ['norte', 'sul', 'leste', 'oeste'] as const;
const DIRECAO_ICON: Record<string, React.ReactNode> = {
    norte: <ArrowUp size={14} />,
    sul: <ArrowDown size={14} />,
    leste: <ArrowRight size={14} />,
    oeste: <ArrowLeft size={14} />,
};

function getVizinhosPorDirecao(vizinhos: Vizinho[]): Record<string, Vizinho[]> {
    const porDir: Record<string, Vizinho[]> = { norte: [], sul: [], leste: [], oeste: [] };
    vizinhos.forEach((v) => {
        const d = v.direcao?.toLowerCase() || 'norte';
        if (porDir[d]) porDir[d].push(v);
    });
    return porDir;
}

export default function VizinhosPanel() {
    const { loteAtual } = useApp();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [resultado, setResultado] = useState<ResultadoVizinhos | null>(null);
    const [vizinhos, setVizinhos] = useState<Vizinho[]>([]);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [editingDir, setEditingDir] = useState<string | null>(null);
    const [manualForm, setManualForm] = useState({ nome: '', cpf: '' });

    const identificar = async () => {
        if (!loteAtual) return;
        setLoading(true);
        setError('');
        setResultado(null);
        setVizinhos([]);
        setSaved(false);
        try {
            const res = await apiClient.identificarVizinhos(loteAtual.id);
            if (res.data) {
                const data = res.data as ResultadoVizinhos;
                setResultado(data);
                setVizinhos(data.vizinhos || []);
            }
            if (res.error) setError(res.error);
            else if ((res.data as ResultadoVizinhos)?.vizinhos?.length) {
                toast.success(`${(res.data as ResultadoVizinhos).vizinhos.length} vizinho(s) identificado(s)`);
            }
        } catch {
            setError('Erro ao identificar vizinhos');
            toast.error('Erro ao identificar vizinhos');
        } finally {
            setLoading(false);
        }
    };

    const salvar = async () => {
        if (!loteAtual || vizinhos.length === 0) return;
        setSaving(true);
        setError('');
        try {
            const payload = vizinhos.map((v) => {
                const isManual = v.lote_id?.startsWith('manual');
                return {
                    lote_id: isManual ? '' : v.lote_id,
                    numero: v.numero,
                    direcao: v.direcao,
                    ...(v.cliente && (v.cliente.nome || v.cliente.cpf) && {
                        nome_vizinho: v.cliente.nome,
                        cpf_confrontante: v.cliente.cpf,
                    }),
                };
            });
            const res = await apiClient.salvarConfrontacoes(loteAtual.id, payload as any);
            if (res.error) {
                setError(res.error);
                toast.error(res.error);
            } else {
                setSaved(true);
                toast.success('Confrontações salvas com sucesso');
            }
        } catch {
            setError('Erro ao salvar');
            toast.error('Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    const updateVizinhoFromForm = (dir: string) => {
        setVizinhos((prev) =>
            prev.map((v) =>
                v.direcao === dir
                    ? { ...v, cliente: { nome: manualForm.nome, cpf: manualForm.cpf || undefined } }
                    : v
            )
        );
        setEditingDir(null);
        setManualForm({ nome: '', cpf: '' });
        toast.success('Vizinho atualizado');
    };

    const addManualVizinho = (dir: string) => {
        if (!manualForm.nome.trim()) {
            toast.error('Informe o nome do proprietário');
            return;
        }
        const novo: Vizinho = {
            lote_id: `manual-${Date.now()}`,
            numero: 0,
            direcao: dir,
            cliente: { nome: manualForm.nome.trim(), cpf: manualForm.cpf || undefined },
        };
        setVizinhos((prev) => [...prev.filter((v) => v.direcao !== dir), novo]);
        setEditingDir(null);
        setManualForm({ nome: '', cpf: '' });
        toast.success('Vizinho adicionado manualmente');
    };

    const removeVizinho = (dir: string) => {
        setVizinhos((prev) => prev.filter((v) => v.direcao !== dir));
        setEditingDir(null);
    };

    const vizinhosPorDir = getVizinhosPorDirecao(vizinhos);
    const highlightedDirections = DIRECOES.filter((d) => (vizinhosPorDir[d]?.length ?? 0) > 0);

    if (!loteAtual) {
        return (
            <div className="panel">
                <div className="panel-empty">
                    <Search size={24} />
                    <p>Selecione um lote para identificar vizinhos</p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>🔍 Vizinhos</h3>
            </div>

            <div className="panel-info">
                <span>Lote #{loteAtual.id} — {loteAtual.nome_cliente}</span>
            </div>

            <button
                className="panel-btn panel-btn--primary panel-btn--full"
                onClick={identificar}
                disabled={loading}
            >
                {loading ? (
                    <>
                        <Loader2 size={14} className="spin" /> Buscando...
                    </>
                ) : (
                    <>
                        <Search size={14} /> Identificar Vizinhos
                    </>
                )}
            </button>

            {error && <div className="panel-error">{error}</div>}

            {vizinhos.length > 0 && (
                <>
                    <div className="panel-result-header" style={{ marginTop: 12 }}>
                        <span>{vizinhos.length} vizinho(s)</span>
                        {resultado?.metadados?.tempo_execucao_ms && (
                            <span className="panel-meta-time">{resultado.metadados.tempo_execucao_ms}ms</span>
                        )}
                    </div>

                    <div className="panel-section" style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                        <DirectionCompass highlightedDirections={highlightedDirections} size="md" />
                    </div>

                    {DIRECOES.map((dir) => {
                        const list = vizinhosPorDir[dir] || [];
                        const isEditing = editingDir === dir;

                        return (
                            <div key={dir} className="panel-section">
                                <h4 className="panel-dir-label">
                                    {DIRECAO_ICON[dir]} {dir.charAt(0).toUpperCase() + dir.slice(1)}
                                </h4>

                                {list.length > 0 && !isEditing ? (
                                    list.map((v, i) => (
                                        <div key={i} className="panel-vizinho-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                            <div>
                                                {v.numero > 0 && <span className="panel-vizinho-num">Lote {v.numero} — </span>}
                                                <span className="panel-vizinho-nome">{v.cliente?.nome || 'Sem nome'}</span>
                                                {v.cliente?.cpf && (
                                                    <span style={{ fontSize: '.75rem', opacity: 0.8, marginLeft: 4 }}>
                                                        {v.cliente.cpf}
                                                    </span>
                                                )}
                                                {v.distancia_metros && (
                                                    <span className="panel-vizinho-dist"> {v.distancia_metros.toFixed(1)}m</span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button
                                                    className="panel-btn panel-btn--sm"
                                                    onClick={() => {
                                                        setEditingDir(dir);
                                                        setManualForm({
                                                            nome: v.cliente?.nome || '',
                                                            cpf: v.cliente?.cpf || '',
                                                        });
                                                    }}
                                                    title="Editar"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                                <button
                                                    className="panel-btn panel-btn--sm"
                                                    onClick={() => removeVizinho(dir)}
                                                    title="Remover"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : list.length > 0 && isEditing ? (
                                    <div className="panel-form" style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 8 }}>
                                        <label className="panel-label">Nome *</label>
                                        <input
                                            className="panel-input"
                                            placeholder="Nome do proprietário"
                                            value={manualForm.nome}
                                            onChange={(e) => setManualForm((p) => ({ ...p, nome: e.target.value }))}
                                        />
                                        <label className="panel-label">CPF</label>
                                        <input
                                            className="panel-input"
                                            placeholder="000.000.000-00"
                                            value={manualForm.cpf}
                                            onChange={(e) => setManualForm((p) => ({ ...p, cpf: formatCPF(e.target.value) }))}
                                        />
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button className="panel-btn panel-btn--primary" onClick={() => updateVizinhoFromForm(dir)}>
                                                Salvar
                                            </button>
                                            <button className="panel-btn" onClick={() => { setEditingDir(null); setManualForm({ nome: '', cpf: '' }); }}>
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                ) : isEditing ? (
                                    <div className="panel-form" style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 8 }}>
                                        <label className="panel-label">Nome *</label>
                                        <input
                                            className="panel-input"
                                            placeholder="Nome do proprietário"
                                            value={manualForm.nome}
                                            onChange={(e) => setManualForm((p) => ({ ...p, nome: e.target.value }))}
                                        />
                                        <label className="panel-label">CPF</label>
                                        <input
                                            className="panel-input"
                                            placeholder="000.000.000-00"
                                            value={manualForm.cpf}
                                            onChange={(e) => setManualForm((p) => ({ ...p, cpf: formatCPF(e.target.value) }))}
                                        />
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button className="panel-btn panel-btn--primary" onClick={() => addManualVizinho(dir)}>
                                                Adicionar
                                            </button>
                                            <button className="panel-btn" onClick={() => { setEditingDir(null); setManualForm({ nome: '', cpf: '' }); }}>
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        className="panel-btn panel-btn--sm"
                                        style={{ borderStyle: 'dashed' }}
                                        onClick={() => setEditingDir(dir)}
                                    >
                                        <Plus size={12} /> Adicionar manualmente
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    <button
                        className="panel-btn panel-btn--success panel-btn--full"
                        onClick={salvar}
                        disabled={saving || saved}
                        style={{ marginTop: 8 }}
                    >
                        {saved ? (
                            '✓ Salvo'
                        ) : saving ? (
                            <>
                                <Loader2 size={14} className="spin" /> Salvando...
                            </>
                        ) : (
                            <>
                                <Save size={14} /> Salvar Confrontações
                            </>
                        )}
                    </button>
                </>
            )}
        </div>
    );
}
