/**
 * ProjetosPanel — CRUD de projetos no sidebar
 */
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { FolderOpen, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

export type ProjetoStatus = 'RASCUNHO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'ARQUIVADO';

interface Projeto {
    id: number;
    nome: string;
    descricao?: string;
    tipo: string;
    status: ProjetoStatus | string;
    criado_em?: string;
}

type TabFiltro = 'pendentes' | 'em_andamento' | 'finalizados' | 'todos';

const PENDENTES_STATUSES: string[] = ['RASCUNHO'];
const EM_ANDAMENTO_STATUSES: string[] = ['EM_ANDAMENTO'];
const FINALIZADOS_STATUSES: string[] = ['CONCLUIDO', 'ARQUIVADO'];

export default function ProjetosPanel() {
    const { setProjetoAtual, setPanel } = useApp();
    const [projetos, setProjetos] = useState<Projeto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<TabFiltro>('todos');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ nome: '', descricao: '', tipo: 'INDIVIDUAL' });

    const carregar = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.getProjects();
            if (res.data) setProjetos(res.data as unknown as Projeto[]);
            else setError(res.error || 'Erro ao carregar');
        } catch {
            setError('Erro de conexão');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carregar(); }, []);

    const { filtrados, counts } = useMemo(() => {
        const pendentes = projetos.filter((p) => PENDENTES_STATUSES.includes(p.status));
        const emAndamento = projetos.filter((p) => EM_ANDAMENTO_STATUSES.includes(p.status));
        const finalizados = projetos.filter((p) => FINALIZADOS_STATUSES.includes(p.status));
        const filtrados =
            tab === 'pendentes' ? pendentes :
                tab === 'em_andamento' ? emAndamento :
                    tab === 'finalizados' ? finalizados : projetos;
        return {
            filtrados,
            counts: {
                pendentes: pendentes.length,
                em_andamento: emAndamento.length,
                finalizados: finalizados.length,
                todos: projetos.length,
            },
        };
    }, [projetos, tab]);

    const salvar = async () => {
        try {
            if (editId) {
                await apiClient.updateProject(editId, formData);
                toast.success('Projeto atualizado');
            } else {
                await apiClient.createProject(formData);
                toast.success('Projeto criado');
            }
            setShowForm(false);
            setEditId(null);
            setFormData({ nome: '', descricao: '', tipo: 'INDIVIDUAL' });
            carregar();
        } catch {
            setError('Erro ao salvar');
            toast.error('Erro ao salvar');
        }
    };

    const excluir = async (id: number) => {
        if (!confirm('Excluir projeto?')) return;
        try {
            await apiClient.deleteProject(id);
            toast.success('Projeto excluído');
            carregar();
        } catch {
            setError('Erro ao excluir');
            toast.error('Erro ao excluir');
        }
    };

    const editar = (p: Projeto) => {
        setEditId(p.id);
        setFormData({ nome: p.nome, descricao: p.descricao || '', tipo: p.tipo });
        setShowForm(true);
    };

    const selecionar = (p: Projeto) => {
        setProjetoAtual(p);
        setPanel('lotes');
    };

    const statusColor: Record<string, string> = {
        RASCUNHO: '#94a3b8',
        EM_ANDAMENTO: '#3b82f6',
        CONCLUIDO: '#10b981',
        ARQUIVADO: '#6b7280',
    };

    if (loading) return <div className="panel-loading"><Loader2 size={20} className="spin" /> Carregando...</div>;

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>📋 Projetos</h3>
                <button className="panel-btn-sm" onClick={() => { setShowForm(true); setEditId(null); setFormData({ nome: '', descricao: '', tipo: 'INDIVIDUAL' }); }}>
                    <Plus size={14} /> Novo
                </button>
            </div>

            {error && <div className="panel-error">{error}</div>}

            <div className="panel-tabs">
                {(['pendentes', 'em_andamento', 'finalizados', 'todos'] as TabFiltro[]).map((t) => (
                    <button
                        key={t}
                        className={`panel-tab ${tab === t ? 'active' : ''}`}
                        onClick={() => setTab(t)}
                    >
                        {t === 'pendentes' ? `Pendentes (${counts.pendentes})` :
                            t === 'em_andamento' ? `Em Andamento (${counts.em_andamento})` :
                                t === 'finalizados' ? `Finalizados (${counts.finalizados})` :
                                    `Todos (${counts.todos})`}
                    </button>
                ))}
            </div>

            {showForm && (
                <div className="panel-form">
                    <input
                        className="panel-input"
                        placeholder="Nome do projeto"
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
                    <select
                        className="panel-input"
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    >
                        <option value="INDIVIDUAL">Individual</option>
                        <option value="LOTEAMENTO">Loteamento</option>
                    </select>
                    <div className="panel-form-actions">
                        <button className="panel-btn panel-btn--primary" onClick={salvar}>
                            {editId ? 'Atualizar' : 'Criar'}
                        </button>
                        <button className="panel-btn" onClick={() => { setShowForm(false); setEditId(null); }}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            <div className="panel-list">
                {filtrados.length === 0 && !showForm && (
                    <div className="panel-empty">
                        <FolderOpen size={24} />
                        <p>Nenhum projeto</p>
                    </div>
                )}
                {filtrados.map((p) => (
                    <div key={p.id} className="panel-card" onClick={() => selecionar(p)}>
                        <div className="panel-card-header">
                            <span className="panel-card-title">{p.nome}</span>
                            <span className="panel-card-badge" style={{ background: statusColor[p.status] || '#94a3b8' }}>
                                {p.status}
                            </span>
                        </div>
                        {p.descricao && <p className="panel-card-desc">{p.descricao}</p>}
                        <div className="panel-card-meta">
                            <span>{p.tipo}</span>
                            <div className="panel-card-actions">
                                <button onClick={(e) => { e.stopPropagation(); editar(p); }}><Pencil size={12} /></button>
                                <button onClick={(e) => { e.stopPropagation(); excluir(p.id); }}><Trash2 size={12} /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
