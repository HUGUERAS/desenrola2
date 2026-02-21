/**
 * ProjetosPanel — CRUD de projetos no sidebar
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
import { FolderOpen, Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react';

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
type Ordenacao = 'status' | 'nome';
type TipoFiltro = 'todos' | 'INDIVIDUAL' | 'LOTEAMENTO';

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
    const [query, setQuery] = useState('');
    const [ordenacao, setOrdenacao] = useState<Ordenacao>('status');
    const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');

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
        const baseFiltrada =
            tab === 'pendentes' ? pendentes :
                tab === 'em_andamento' ? emAndamento :
                    tab === 'finalizados' ? finalizados : projetos;

        const porTipo =
            tipoFiltro === 'todos'
                ? baseFiltrada
                : baseFiltrada.filter((p) => p.tipo === tipoFiltro);

        const q = query.trim().toLowerCase();
        const porBusca = q
            ? porTipo.filter((p) =>
                `${p.nome} ${p.descricao || ''} ${p.tipo}`.toLowerCase().includes(q)
            )
            : porTipo;

        const statusPriority: Record<string, number> = {
            EM_ANDAMENTO: 0,
            RASCUNHO: 1,
            CONCLUIDO: 2,
            ARQUIVADO: 3,
        };

        const filtrados = [...porBusca].sort((a, b) => {
            if (ordenacao === 'nome') return a.nome.localeCompare(b.nome);
            const diff = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
            if (diff !== 0) return diff;
            return a.nome.localeCompare(b.nome);
        });

        return {
            filtrados,
            counts: {
                pendentes: pendentes.length,
                em_andamento: emAndamento.length,
                finalizados: finalizados.length,
                todos: projetos.length,
            },
        };
    }, [projetos, tab, query, ordenacao, tipoFiltro]);

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

            <div className="panel-form">
                <div className="panel-search">
                    <Search size={12} />
                    <input
                        className="panel-input"
                        placeholder="Buscar por nome, descrição ou tipo"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <select
                    className="panel-input"
                    value={ordenacao}
                    onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
                >
                    <option value="status">Ordenar: prioridade de status</option>
                    <option value="nome">Ordenar: nome</option>
                </select>
                <select
                    className="panel-input"
                    value={tipoFiltro}
                    onChange={(e) => setTipoFiltro(e.target.value as TipoFiltro)}
                >
                    <option value="todos">Tipo: todos</option>
                    <option value="INDIVIDUAL">Tipo: individual</option>
                    <option value="LOTEAMENTO">Tipo: loteamento</option>
                </select>
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
                            <span className="panel-card-badge" style={{ background: getStatusColor(p.status, PROJECT_STATUS_COLOR) }}>
                                {getStatusLabel(p.status, PROJECT_STATUS_LABEL)}
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
