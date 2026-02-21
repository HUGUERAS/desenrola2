/**
 * LotesPanel — Lista e criação de lotes do projeto selecionado
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { getStatusColor, LOTE_STATUS_COLOR } from '../../features/app-shell/status';
import { Layers, Plus, ArrowLeft, Loader2, Copy, ExternalLink, User } from 'lucide-react';
import { formatCPF, formatPhone } from '../../lib/format-utils';

interface Lote {
    id: number;
    nome_cliente: string;
    email_cliente?: string;
    status: string;
    token_acesso?: string;
    geom?: string;
}

export default function LotesPanel() {
    const { projetoAtual, setLoteAtual, setPanel } = useApp();
    const [lotes, setLotes] = useState<Lote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        nome_cliente: '',
        email_cliente: '',
        telefone_cliente: '',
        cpf_cnpj_cliente: '',
    });
    const [copiedToken, setCopiedToken] = useState<number | null>(null);

    const carregar = async () => {
        if (!projetoAtual) return;
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.getLotes(projetoAtual.id);
            if (res.data) setLotes(res.data as unknown as Lote[]);
            else setError(res.error || 'Erro ao carregar');
        } catch {
            setError('Erro de conexão');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carregar(); }, [projetoAtual?.id]);

    const criar = async () => {
        if (!projetoAtual) return;
        try {
            await apiClient.createLote({
                projeto_id: projetoAtual.id,
                ...formData,
            });
            setShowForm(false);
            setFormData({ nome_cliente: '', email_cliente: '', telefone_cliente: '', cpf_cnpj_cliente: '' });
            toast.success('Lote criado');
            carregar();
        } catch {
            setError('Erro ao criar lote');
            toast.error('Erro ao criar lote');
        }
    };

    const copiarLink = (lote: Lote) => {
        if (!lote.token_acesso) return;
        const url = `${window.location.origin}/acesso/${lote.token_acesso}`;
        navigator.clipboard.writeText(url);
        setCopiedToken(lote.id);
        setTimeout(() => setCopiedToken(null), 2000);
    };

    const selecionar = (lote: Lote) => {
        setLoteAtual(lote as any);
    };

    const verDados = (lote: Lote) => {
        setLoteAtual(lote as any);
        setPanel('cliente-dados');
    };

    if (!projetoAtual) {
        return (
            <div className="panel">
                <div className="panel-empty">
                    <Layers size={24} />
                    <p>Selecione um projeto primeiro</p>
                    <button className="panel-btn panel-btn--primary" onClick={() => setPanel('projetos')}>
                        <ArrowLeft size={14} /> Ir para Projetos
                    </button>
                </div>
            </div>
        );
    }

    if (loading) return <div className="panel-loading"><Loader2 size={20} className="spin" /> Carregando...</div>;

    return (
        <div className="panel">
            <div className="panel-header">
                <div>
                    <button className="panel-link" onClick={() => setPanel('projetos')}>
                        <ArrowLeft size={12} /> Projetos
                    </button>
                    <h3>📦 Lotes — {projetoAtual.nome}</h3>
                </div>
                <button className="panel-btn-sm" onClick={() => setShowForm(true)}>
                    <Plus size={14} /> Novo
                </button>
            </div>

            {error && <div className="panel-error">{error}</div>}

            {showForm && (
                <div className="panel-form">
                    <input
                        className="panel-input"
                        placeholder="Nome do cliente"
                        value={formData.nome_cliente}
                        onChange={(e) => setFormData({ ...formData, nome_cliente: e.target.value })}
                    />
                    <input
                        className="panel-input"
                        placeholder="Email (opcional)"
                        value={formData.email_cliente}
                        onChange={(e) => setFormData({ ...formData, email_cliente: e.target.value })}
                    />
                    <input
                        className="panel-input"
                        placeholder="Telefone (opcional) — (62) 99999-0000"
                        value={formData.telefone_cliente}
                        onChange={(e) => setFormData({ ...formData, telefone_cliente: formatPhone(e.target.value) })}
                    />
                    <input
                        className="panel-input"
                        placeholder="CPF/CNPJ (opcional) — 000.000.000-00"
                        value={formData.cpf_cnpj_cliente}
                        onChange={(e) => setFormData({ ...formData, cpf_cnpj_cliente: formatCPF(e.target.value) })}
                    />
                    <div className="panel-form-actions">
                        <button className="panel-btn panel-btn--primary" onClick={criar}>Criar Lote</button>
                        <button className="panel-btn" onClick={() => setShowForm(false)}>Cancelar</button>
                    </div>
                </div>
            )}

            <div className="panel-list">
                {lotes.length === 0 && !showForm && (
                    <div className="panel-empty">
                        <Layers size={24} />
                        <p>Nenhum lote neste projeto</p>
                    </div>
                )}
                {lotes.map((lote) => (
                    <div key={lote.id} className="panel-card" onClick={() => selecionar(lote)}>
                        <div className="panel-card-header">
                            <span className="panel-card-title">{lote.nome_cliente}</span>
                            <span className="panel-card-badge" style={{ background: getStatusColor(lote.status, LOTE_STATUS_COLOR) }}>
                                {lote.status}
                            </span>
                        </div>
                        {lote.email_cliente && <p className="panel-card-desc">{lote.email_cliente}</p>}
                        <div className="panel-card-meta">
                            <span>#{lote.id}</span>
                            <div className="panel-card-actions">
                                {lote.token_acesso && (
                                    <button onClick={(e) => { e.stopPropagation(); copiarLink(lote); }} title="Copiar magic link">
                                        {copiedToken === lote.id ? '✓' : <Copy size={12} />}
                                    </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); verDados(lote); }} title="Ver dados do cliente">
                                    <User size={12} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); selecionar(lote); }} title="Abrir">
                                    <ExternalLink size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
