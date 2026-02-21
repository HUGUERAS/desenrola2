/**
 * LoteamentosPanel — Gestão de projetos do tipo LOTEAMENTO
 * Exclusivo para topógrafos. Filtra apenas projetos LOTEAMENTO,
 * exibe progresso de lotes e permite acesso rápido ao painel de Lotes.
 */
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import {
    getStatusColor,
    getStatusLabel,
    PROJECT_STATUS_COLOR,
    PROJECT_STATUS_LABEL,
} from '../../features/app-shell/status';
import {
    Map,
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Layers,
    ChevronRight,
    Users,
    CheckCircle2,
    PenTool,
} from 'lucide-react';

interface Loteamento {
    id: number;
    nome: string;
    descricao?: string;
    tipo: string;
    status: string;
    cidade?: string;
    estado?: string;
    criado_em?: string;
}

interface LoteStats {
    total: number;
    desenhados: number;
    validados: number;
}

type TabFiltro = 'todos' | 'em_andamento' | 'concluidos';

const EM_ANDAMENTO_STATUSES = ['RASCUNHO', 'EM_ANDAMENTO'];
const CONCLUIDOS_STATUSES = ['CONCLUIDO', 'ARQUIVADO'];

export default function LoteamentosPanel() {
    const { setProjetoAtual, setPanel } = useApp();

    const [loteamentos, setLoteamentos] = useState<Loteamento[]>([]);
    const [stats, setStats] = useState<Record<number, LoteStats>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<TabFiltro>('todos');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        nome: '',
        descricao: '',
        cidade: '',
        estado: '',
        observacoes: '',
    });

    const carregar = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.getProjects();
            if (res.data) {
                const filtrados = (res.data as unknown as Loteamento[]).filter(
                    (p) => p.tipo === 'LOTEAMENTO'
                );
                setLoteamentos(filtrados);
                carregarStats(filtrados);
            } else {
                setError(res.error || 'Erro ao carregar');
            }
        } catch {
            setError('Erro de conexão');
        } finally {
            setLoading(false);
        }
    };

    const carregarStats = async (lista: Loteamento[]) => {
        const novasStats: Record<number, LoteStats> = {};
        await Promise.allSettled(
            lista.map(async (l) => {
                const res = await apiClient.getLotes(l.id);
                if (res.data) {
                    const lotes = res.data as unknown as Array<{ geom?: string; status?: string }>;
                    novasStats[l.id] = {
                        total: lotes.length,
                        desenhados: lotes.filter((lt) => lt.geom).length,
                        validados: lotes.filter((lt) => lt.status === 'APROVADO').length,
                    };
                }
            })
        );
        setStats(novasStats);
    };

    useEffect(() => { carregar(); }, []);

    const { filtrados, counts } = useMemo(() => {
        const emAndamento = loteamentos.filter((p) => EM_ANDAMENTO_STATUSES.includes(p.status));
        const concluidos = loteamentos.filter((p) => CONCLUIDOS_STATUSES.includes(p.status));
        const filtrados =
            tab === 'em_andamento' ? emAndamento :
                tab === 'concluidos' ? concluidos :
                    loteamentos;
        return {
            filtrados,
            counts: {
                todos: loteamentos.length,
                em_andamento: emAndamento.length,
                concluidos: concluidos.length,
            },
        };
    }, [loteamentos, tab]);

    const salvar = async () => {
        if (!formData.nome.trim()) {
            toast.error('Nome é obrigatório');
            return;
        }
        try {
            if (editId) {
                await apiClient.updateProject(editId, { ...formData, tipo: 'LOTEAMENTO' });
                toast.success('Loteamento atualizado');
            } else {
                await apiClient.createProject({ ...formData, tipo: 'LOTEAMENTO' });
                toast.success('Loteamento criado');
            }
            fecharForm();
            carregar();
        } catch {
            toast.error('Erro ao salvar');
        }
    };

    const excluir = async (id: number) => {
        if (!confirm('Excluir este loteamento e todos os seus lotes?')) return;
        try {
            await apiClient.deleteProject(id);
            toast.success('Loteamento excluído');
            carregar();
        } catch {
            toast.error('Erro ao excluir');
        }
    };

    const editar = (l: Loteamento) => {
        setEditId(l.id);
        setFormData({
            nome: l.nome,
            descricao: l.descricao || '',
            cidade: l.cidade || '',
            estado: l.estado || '',
            observacoes: '',
        });
        setShowForm(true);
    };

    const selecionar = (l: Loteamento) => {
        setProjetoAtual(l as any);
        setPanel('lotes');
    };

    const fecharForm = () => {
        setShowForm(false);
        setEditId(null);
        setFormData({ nome: '', descricao: '', cidade: '', estado: '', observacoes: '' });
    };

    const abrirNovoForm = () => {
        fecharForm();
        setShowForm(true);
    };

    if (loading) {
        return (
            <div className="panel-loading">
                <Loader2 size={20} className="spin" /> Carregando loteamentos...
            </div>
        );
    }

    return (
        <div className="panel">
            <div className="panel-header">
                <h3 className="flex items-center gap-2">
                    <Map size={16} /> Loteamentos
                </h3>
                <button className="panel-btn-sm" onClick={abrirNovoForm}>
                    <Plus size={14} /> Novo
                </button>
            </div>

            {error && <div className="panel-error">{error}</div>}

            {/* Abas */}
            <div className="panel-tabs">
                {(['todos', 'em_andamento', 'concluidos'] as TabFiltro[]).map((t) => (
                    <button
                        key={t}
                        className={`panel-tab ${tab === t ? 'active' : ''}`}
                        onClick={() => setTab(t)}
                    >
                        {t === 'todos' ? `Todos (${counts.todos})` :
                            t === 'em_andamento' ? `Em Andamento (${counts.em_andamento})` :
                                `Concluídos (${counts.concluidos})`}
                    </button>
                ))}
            </div>

            {/* Formulário */}
            {showForm && (
                <div className="panel-form">
                    <input
                        className="panel-input"
                        placeholder="Nome do loteamento *"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    />
                    <textarea
                        className="panel-input"
                        placeholder="Descrição (opcional)"
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        rows={2}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                        <input
                            className="panel-input"
                            placeholder="Cidade"
                            value={formData.cidade}
                            onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                        />
                        <input
                            className="panel-input"
                            placeholder="UF"
                            maxLength={2}
                            style={{ width: '56px' }}
                            value={formData.estado}
                            onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                        />
                    </div>
                    <div className="panel-form-actions">
                        <button className="panel-btn panel-btn--primary" onClick={salvar}>
                            {editId ? 'Atualizar' : 'Criar'}
                        </button>
                        <button className="panel-btn" onClick={fecharForm}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Lista */}
            <div className="panel-list">
                {filtrados.length === 0 && !showForm && (
                    <div className="panel-empty">
                        <Map size={28} />
                        <p>Nenhum loteamento</p>
                        <small>Clique em "Novo" para criar</small>
                    </div>
                )}

                {filtrados.map((l) => {
                    const s = stats[l.id];
                    const pct = s && s.total > 0 ? Math.round((s.desenhados / s.total) * 100) : null;

                    return (
                        <div
                            key={l.id}
                            className="panel-card"
                            onClick={() => selecionar(l)}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* Cabeçalho do card */}
                            <div className="panel-card-header">
                                <span className="panel-card-title">{l.nome}</span>
                                <span
                                    className="panel-card-badge"
                                    style={{ background: getStatusColor(l.status, PROJECT_STATUS_COLOR) }}
                                >
                                    {getStatusLabel(l.status, PROJECT_STATUS_LABEL)}
                                </span>
                            </div>

                            {/* Localização */}
                            {(l.cidade || l.estado) && (
                                <p className="panel-card-desc" style={{ marginBottom: '6px' }}>
                                    {[l.cidade, l.estado].filter(Boolean).join(' — ')}
                                </p>
                            )}

                            {/* Stats de progresso */}
                            {s ? (
                                <div style={{ marginBottom: '6px' }}>
                                    <div style={{
                                        display: 'flex',
                                        gap: '10px',
                                        fontSize: '11px',
                                        color: 'var(--text-secondary)',
                                        marginBottom: '4px',
                                    }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <Layers size={11} /> {s.total} lotes
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <PenTool size={11} /> {s.desenhados} desenhados
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <CheckCircle2 size={11} /> {s.validados} aprovados
                                        </span>
                                    </div>
                                    {pct !== null && (
                                        <div style={{
                                            height: '4px',
                                            background: 'var(--border)',
                                            borderRadius: '2px',
                                            overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${pct}%`,
                                                background: pct === 100 ? '#10b981' : '#3b82f6',
                                                borderRadius: '2px',
                                                transition: 'width 0.4s ease',
                                            }} />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    <Loader2 size={10} className="spin" style={{ display: 'inline', marginRight: 4 }} />
                                    carregando stats...
                                </div>
                            )}

                            {/* Ações */}
                            <div className="panel-card-meta">
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    {pct !== null ? `${pct}% desenhado` : 'sem lotes'}
                                </span>
                                <div className="panel-card-actions" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        title="Editar"
                                        onClick={(e) => { e.stopPropagation(); editar(l); }}
                                    >
                                        <Pencil size={12} />
                                    </button>
                                    <button
                                        title="Excluir"
                                        onClick={(e) => { e.stopPropagation(); excluir(l.id); }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                    <button
                                        title="Abrir lotes"
                                        onClick={(e) => { e.stopPropagation(); selecionar(l); }}
                                    >
                                        <ChevronRight size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
