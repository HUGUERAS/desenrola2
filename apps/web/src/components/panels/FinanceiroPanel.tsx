/**
 * FinanceiroPanel — Orçamentos, Despesas e Pagamentos
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { DollarSign, Plus, Trash2, Loader2, X } from 'lucide-react';

type Tab = 'orcamentos' | 'despesas' | 'pagamentos';

export default function FinanceiroPanel() {
    const { projetoAtual } = useApp();
    const [tab, setTab] = useState<Tab>('orcamentos');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [orcamentos, setOrcamentos] = useState<any[]>([]);
    const [despesas, setDespesas] = useState<any[]>([]);
    const [pagamentos, setPagamentos] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);

    // Form state
    const [formDespesa, setFormDespesa] = useState({ descricao: '', valor: '', data: '', categoria: 'SERVICO' });
    const [formPagamento, setFormPagamento] = useState({ lote_id: '', valor_total: '', metodo: 'PIX' });
    const [formOrcamento, setFormOrcamento] = useState({ valor: '', observacoes: '' });

    const carregar = async () => {
        setLoading(true);
        setError('');
        try {
            const pid = projetoAtual?.id;
            const [orc, desp, pag] = await Promise.all([
                apiClient.getOrcamentos(pid),
                apiClient.getDespesas(pid),
                apiClient.getPagamentos(pid),
            ]);
            if (orc.data) setOrcamentos(orc.data);
            if (desp.data) setDespesas(desp.data);
            if (pag.data) setPagamentos(pag.data);
        } catch {
            setError('Erro ao carregar dados financeiros');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carregar(); }, [projetoAtual?.id]);

    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const hoje = new Date().toISOString().split('T')[0];

    const totalDespesas = despesas.reduce((s, d) => s + (d.valor || 0), 0);
    const totalPago = pagamentos.reduce((s, p) => s + (p.valor_pago || 0), 0);
    const totalOrcado = orcamentos.reduce((s, o) => s + (o.valor || 0), 0);

    const statusFinanceiro = (item: { valor_total?: number; valor_pago?: number; valor?: number; data?: string; data_vencimento?: string }, tipo: 'pagamento' | 'despesa') => {
        const total = tipo === 'pagamento' ? (item.valor_total || 0) : (item.valor || 0);
        const pago = tipo === 'pagamento' ? (item.valor_pago || 0) : 0;
        const dataVenc = item.data_vencimento || item.data;
        if (tipo === 'pagamento' && pago >= total) return 'PAGO';
        if (tipo === 'pagamento' && pago > 0) return 'PARCIAL';
        if (dataVenc && dataVenc < hoje) return 'ATRASADO';
        return 'PENDENTE';
    };

    const getStatusBadgeClass = (status: string) => {
        if (status === 'ATRASADO') return 'panel-badge panel-badge--atrasado';
        if (status === 'PAGO') return 'panel-badge panel-badge--success';
        if (status === 'PARCIAL') return 'panel-badge panel-badge--warning';
        return 'panel-badge panel-badge--muted';
    };

    const qtdAtrasados = [
        ...pagamentos.filter((p) => statusFinanceiro(p, 'pagamento') === 'ATRASADO'),
        ...despesas.filter((d) => statusFinanceiro(d, 'despesa') === 'ATRASADO'),
    ].length;

    const abrirNovo = () => setShowModal(true);
    const fecharModal = () => {
        setShowModal(false);
        setFormDespesa({ descricao: '', valor: '', data: '', categoria: 'SERVICO' });
        setFormOrcamento({ valor: '', observacoes: '' });
        setFormPagamento({ lote_id: '', valor_total: '', metodo: 'PIX' });
    };

    const criarDespesa = async () => {
        if (!projetoAtual) return;
        try {
            await apiClient.createDespesa({
                projeto_id: projetoAtual.id,
                descricao: formDespesa.descricao,
                valor: parseFloat(formDespesa.valor),
                data: formDespesa.data || new Date().toISOString().split('T')[0],
                categoria: formDespesa.categoria,
            });
            fecharModal();
            toast.success('Despesa criada');
            carregar();
        } catch {
            setError('Erro ao criar despesa');
            toast.error('Erro ao criar despesa');
        }
    };

    const criarOrcamento = async () => {
        try {
            await apiClient.createOrcamento({
                projeto_id: projetoAtual?.id,
                valor: parseFloat(formOrcamento.valor),
                observacoes: formOrcamento.observacoes,
            });
            fecharModal();
            toast.success('Orçamento criado');
            carregar();
        } catch {
            setError('Erro ao criar orçamento');
            toast.error('Erro ao criar orçamento');
        }
    };

    const criarPagamento = async () => {
        try {
            await apiClient.createPagamento({
                lote_id: parseInt(formPagamento.lote_id),
                valor_total: parseFloat(formPagamento.valor_total),
                metodo_pagamento: formPagamento.metodo,
            });
            fecharModal();
            toast.success('Pagamento registrado');
            carregar();
        } catch {
            setError('Erro ao criar pagamento');
            toast.error('Erro ao criar pagamento');
        }
    };

    const excluir = async (tipo: Tab, id: number) => {
        if (!confirm('Excluir?')) return;
        try {
            if (tipo === 'despesas') await apiClient.deleteDespesa(id);
            if (tipo === 'orcamentos') await apiClient.deleteOrcamento(id);
            if (tipo === 'pagamentos') await apiClient.deletePagamento(id);
            toast.success('Registro excluído');
            carregar();
        } catch {
            setError('Erro ao excluir');
            toast.error('Erro ao excluir');
        }
    };

    if (loading) return <div className="panel-loading"><Loader2 size={20} className="spin" /> Carregando...</div>;

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>💰 Financeiro</h3>
                <button className="panel-btn-sm" onClick={abrirNovo}>
                    <Plus size={14} /> Novo
                </button>
            </div>

            {/* Resumo */}
            <div className="panel-finance-summary">
                <div className="panel-finance-stat">
                    <span className="panel-finance-label">Orçado</span>
                    <span className="panel-finance-value">{fmt(totalOrcado)}</span>
                </div>
                <div className="panel-finance-stat">
                    <span className="panel-finance-label">Despesas</span>
                    <span className="panel-finance-value text-error">{fmt(totalDespesas)}</span>
                </div>
                <div className="panel-finance-stat">
                    <span className="panel-finance-label">Recebido</span>
                    <span className="panel-finance-value text-success">{fmt(totalPago)}</span>
                </div>
                {qtdAtrasados > 0 && (
                    <div className="panel-finance-stat">
                        <span className="panel-finance-label">Atrasados</span>
                        <span className="panel-finance-value" style={{ color: '#ef4444' }}>{qtdAtrasados}</span>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="panel-tabs">
                {(['orcamentos', 'despesas', 'pagamentos'] as Tab[]).map((t) => (
                    <button
                        key={t}
                        className={`panel-tab ${tab === t ? 'active' : ''}`}
                        onClick={() => setTab(t)}
                    >
                        {t === 'orcamentos' ? `Orçam. (${orcamentos.length})` :
                            t === 'despesas' ? `Desp. (${despesas.length})` :
                                `Pgtos. (${pagamentos.length})`}
                    </button>
                ))}
            </div>

            {error && <div className="panel-error">{error}</div>}

            {/* Modal Novo */}
            {showModal && (
                <div className="panel-modal-overlay" onClick={fecharModal}>
                    <div className="panel-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="panel-modal-header">
                            <h4>
                                {tab === 'orcamentos' ? 'Novo orçamento' :
                                    tab === 'despesas' ? 'Nova despesa' : 'Novo pagamento'}
                            </h4>
                            <button className="panel-modal-close" onClick={fecharModal} aria-label="Fechar">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="panel-modal-body">
                            {tab === 'despesas' && (
                                <div className="panel-form">
                                    <label className="panel-label">Descrição</label>
                                    <input className="panel-input" placeholder="Descrição" value={formDespesa.descricao} onChange={(e) => setFormDespesa({ ...formDespesa, descricao: e.target.value })} />
                                    <label className="panel-label">Valor (R$)</label>
                                    <input className="panel-input" type="number" placeholder="Valor" value={formDespesa.valor} onChange={(e) => setFormDespesa({ ...formDespesa, valor: e.target.value })} />
                                    <label className="panel-label">Data / Vencimento</label>
                                    <input className="panel-input" type="date" value={formDespesa.data} onChange={(e) => setFormDespesa({ ...formDespesa, data: e.target.value })} />
                                    <label className="panel-label">Categoria</label>
                                    <select className="panel-input" value={formDespesa.categoria} onChange={(e) => setFormDespesa({ ...formDespesa, categoria: e.target.value })}>
                                        <option value="SERVICO">Serviço</option>
                                        <option value="MATERIAL">Material</option>
                                        <option value="TRANSPORTE">Transporte</option>
                                        <option value="OUTROS">Outros</option>
                                    </select>
                                    <div className="panel-form-actions">
                                        <button className="panel-btn panel-btn--primary" onClick={criarDespesa}>Criar</button>
                                        <button className="panel-btn" onClick={fecharModal}>Cancelar</button>
                                    </div>
                                </div>
                            )}

                            {tab === 'orcamentos' && (
                                <div className="panel-form">
                                    <label className="panel-label">Valor (R$)</label>
                                    <input className="panel-input" type="number" placeholder="Valor" value={formOrcamento.valor} onChange={(e) => setFormOrcamento({ ...formOrcamento, valor: e.target.value })} />
                                    <label className="panel-label">Observações</label>
                                    <textarea className="panel-input" placeholder="Observações" value={formOrcamento.observacoes} onChange={(e) => setFormOrcamento({ ...formOrcamento, observacoes: e.target.value })} rows={2} />
                                    <div className="panel-form-actions">
                                        <button className="panel-btn panel-btn--primary" onClick={criarOrcamento}>Criar</button>
                                        <button className="panel-btn" onClick={fecharModal}>Cancelar</button>
                                    </div>
                                </div>
                            )}

                            {tab === 'pagamentos' && (
                                <div className="panel-form">
                                    <label className="panel-label">ID do Lote</label>
                                    <input className="panel-input" type="number" placeholder="ID do Lote" value={formPagamento.lote_id} onChange={(e) => setFormPagamento({ ...formPagamento, lote_id: e.target.value })} />
                                    <label className="panel-label">Valor (R$)</label>
                                    <input className="panel-input" type="number" placeholder="Valor" value={formPagamento.valor_total} onChange={(e) => setFormPagamento({ ...formPagamento, valor_total: e.target.value })} />
                                    <label className="panel-label">Método</label>
                                    <select className="panel-input" value={formPagamento.metodo} onChange={(e) => setFormPagamento({ ...formPagamento, metodo: e.target.value })}>
                                        <option value="PIX">PIX</option>
                                        <option value="BOLETO">Boleto</option>
                                        <option value="DINHEIRO">Dinheiro</option>
                                        <option value="TRANSFERENCIA">Transferência</option>
                                    </select>
                                    <div className="panel-form-actions">
                                        <button className="panel-btn panel-btn--primary" onClick={criarPagamento}>Criar</button>
                                        <button className="panel-btn" onClick={fecharModal}>Cancelar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabelas */}
            <div className="panel-table-wrap">
                {tab === 'orcamentos' && (
                    orcamentos.length > 0 ? (
                        <table className="panel-table">
                            <thead>
                                <tr>
                                    <th>Descrição / Valor</th>
                                    <th>Data</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orcamentos.map((o) => (
                                    <tr key={o.id}>
                                        <td>
                                            <strong>{fmt(o.valor)}</strong>
                                            {o.observacoes && <div className="panel-muted">{o.observacoes}</div>}
                                        </td>
                                        <td>{o.criado_em ? new Date(o.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
                                        <td>
                                            <span className={`panel-badge ${o.status === 'APROVADO' ? 'panel-badge--success' : 'panel-badge--muted'}`}>
                                                {o.status || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="panel-table-actions">
                                                <button onClick={() => excluir('orcamentos', o.id)} title="Excluir"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="panel-empty" style={{ padding: '24px' }}>
                            <DollarSign size={24} />
                            <p>Nenhum orçamento</p>
                        </div>
                    )
                )}

                {tab === 'despesas' && (
                    despesas.length > 0 ? (
                        <table className="panel-table">
                            <thead>
                                <tr>
                                    <th>Descrição / Valor</th>
                                    <th>Data</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {despesas.map((d) => {
                                    const status = statusFinanceiro(d, 'despesa');
                                    return (
                                        <tr key={d.id}>
                                            <td>
                                                <strong>{d.descricao}</strong>
                                                <div className="panel-muted">{fmt(d.valor)} · {d.categoria}</div>
                                            </td>
                                            <td>{d.data || d.data_vencimento || '—'}</td>
                                            <td>
                                                <span className={getStatusBadgeClass(status)}>{status}</span>
                                            </td>
                                            <td>
                                                <div className="panel-table-actions">
                                                    <button onClick={() => excluir('despesas', d.id)} title="Excluir"><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="panel-empty" style={{ padding: '24px' }}>
                            <DollarSign size={24} />
                            <p>Nenhuma despesa</p>
                        </div>
                    )
                )}

                {tab === 'pagamentos' && (
                    pagamentos.length > 0 ? (
                        <table className="panel-table">
                            <thead>
                                <tr>
                                    <th>Descrição / Valor</th>
                                    <th>Data</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagamentos.map((p) => {
                                    const status = statusFinanceiro(p, 'pagamento');
                                    return (
                                        <tr key={p.id}>
                                            <td>
                                                <strong>Lote #{p.lote_id}</strong>
                                                <div className="panel-muted">{fmt(p.valor_pago || 0)} / {fmt(p.valor_total || 0)}</div>
                                            </td>
                                            <td>{p.data_pagamento || p.data_vencimento || '—'}</td>
                                            <td>
                                                <span className={getStatusBadgeClass(status)}>{status}</span>
                                            </td>
                                            <td>
                                                <div className="panel-table-actions">
                                                    <button onClick={() => excluir('pagamentos', p.id)} title="Excluir"><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="panel-empty" style={{ padding: '24px' }}>
                            <DollarSign size={24} />
                            <p>Nenhum pagamento</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
