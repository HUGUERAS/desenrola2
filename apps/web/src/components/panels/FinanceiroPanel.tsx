/**
 * FinanceiroPanel — Orçamentos, Despesas e Pagamentos
 */
import { useState, useEffect } from 'react';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { DollarSign, Plus, Trash2, Loader2 } from 'lucide-react';

type Tab = 'orcamentos' | 'despesas' | 'pagamentos';

export default function FinanceiroPanel() {
    const { projetoAtual } = useApp();
    const [tab, setTab] = useState<Tab>('orcamentos');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [orcamentos, setOrcamentos] = useState<any[]>([]);
    const [despesas, setDespesas] = useState<any[]>([]);
    const [pagamentos, setPagamentos] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);

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

    const totalDespesas = despesas.reduce((s, d) => s + (d.valor || 0), 0);
    const totalPago = pagamentos.reduce((s, p) => s + (p.valor_pago || 0), 0);
    const totalOrcado = orcamentos.reduce((s, o) => s + (o.valor || 0), 0);

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
            setShowForm(false);
            setFormDespesa({ descricao: '', valor: '', data: '', categoria: 'SERVICO' });
            carregar();
        } catch { setError('Erro ao criar despesa'); }
    };

    const criarOrcamento = async () => {
        try {
            await apiClient.createOrcamento({
                projeto_id: projetoAtual?.id,
                valor: parseFloat(formOrcamento.valor),
                observacoes: formOrcamento.observacoes,
            });
            setShowForm(false);
            setFormOrcamento({ valor: '', observacoes: '' });
            carregar();
        } catch { setError('Erro ao criar orçamento'); }
    };

    const criarPagamento = async () => {
        try {
            await apiClient.createPagamento({
                lote_id: parseInt(formPagamento.lote_id),
                valor_total: parseFloat(formPagamento.valor_total),
                metodo_pagamento: formPagamento.metodo,
            });
            setShowForm(false);
            setFormPagamento({ lote_id: '', valor_total: '', metodo: 'PIX' });
            carregar();
        } catch { setError('Erro ao criar pagamento'); }
    };

    const excluir = async (tipo: Tab, id: number) => {
        if (!confirm('Excluir?')) return;
        try {
            if (tipo === 'despesas') await apiClient.deleteDespesa(id);
            if (tipo === 'orcamentos') await apiClient.deleteOrcamento(id);
            if (tipo === 'pagamentos') await apiClient.deletePagamento(id);
            carregar();
        } catch { setError('Erro ao excluir'); }
    };

    if (loading) return <div className="panel-loading"><Loader2 size={20} className="spin" /> Carregando...</div>;

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>💰 Financeiro</h3>
                <button className="panel-btn-sm" onClick={() => setShowForm(!showForm)}>
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
            </div>

            {/* Tabs */}
            <div className="panel-tabs">
                {(['orcamentos', 'despesas', 'pagamentos'] as Tab[]).map((t) => (
                    <button
                        key={t}
                        className={`panel-tab ${tab === t ? 'active' : ''}`}
                        onClick={() => { setTab(t); setShowForm(false); }}
                    >
                        {t === 'orcamentos' ? `Orçam. (${orcamentos.length})` :
                            t === 'despesas' ? `Desp. (${despesas.length})` :
                                `Pgtos. (${pagamentos.length})`}
                    </button>
                ))}
            </div>

            {error && <div className="panel-error">{error}</div>}

            {/* Forms */}
            {showForm && tab === 'despesas' && (
                <div className="panel-form">
                    <input className="panel-input" placeholder="Descrição" value={formDespesa.descricao} onChange={(e) => setFormDespesa({ ...formDespesa, descricao: e.target.value })} />
                    <input className="panel-input" type="number" placeholder="Valor (R$)" value={formDespesa.valor} onChange={(e) => setFormDespesa({ ...formDespesa, valor: e.target.value })} />
                    <input className="panel-input" type="date" value={formDespesa.data} onChange={(e) => setFormDespesa({ ...formDespesa, data: e.target.value })} />
                    <select className="panel-input" value={formDespesa.categoria} onChange={(e) => setFormDespesa({ ...formDespesa, categoria: e.target.value })}>
                        <option value="SERVICO">Serviço</option>
                        <option value="MATERIAL">Material</option>
                        <option value="TRANSPORTE">Transporte</option>
                        <option value="OUTROS">Outros</option>
                    </select>
                    <div className="panel-form-actions">
                        <button className="panel-btn panel-btn--primary" onClick={criarDespesa}>Criar</button>
                        <button className="panel-btn" onClick={() => setShowForm(false)}>Cancelar</button>
                    </div>
                </div>
            )}

            {showForm && tab === 'orcamentos' && (
                <div className="panel-form">
                    <input className="panel-input" type="number" placeholder="Valor (R$)" value={formOrcamento.valor} onChange={(e) => setFormOrcamento({ ...formOrcamento, valor: e.target.value })} />
                    <textarea className="panel-input" placeholder="Observações" value={formOrcamento.observacoes} onChange={(e) => setFormOrcamento({ ...formOrcamento, observacoes: e.target.value })} rows={2} />
                    <div className="panel-form-actions">
                        <button className="panel-btn panel-btn--primary" onClick={criarOrcamento}>Criar</button>
                        <button className="panel-btn" onClick={() => setShowForm(false)}>Cancelar</button>
                    </div>
                </div>
            )}

            {showForm && tab === 'pagamentos' && (
                <div className="panel-form">
                    <input className="panel-input" type="number" placeholder="ID do Lote" value={formPagamento.lote_id} onChange={(e) => setFormPagamento({ ...formPagamento, lote_id: e.target.value })} />
                    <input className="panel-input" type="number" placeholder="Valor (R$)" value={formPagamento.valor_total} onChange={(e) => setFormPagamento({ ...formPagamento, valor_total: e.target.value })} />
                    <select className="panel-input" value={formPagamento.metodo} onChange={(e) => setFormPagamento({ ...formPagamento, metodo: e.target.value })}>
                        <option value="PIX">PIX</option>
                        <option value="BOLETO">Boleto</option>
                        <option value="DINHEIRO">Dinheiro</option>
                        <option value="TRANSFERENCIA">Transferência</option>
                    </select>
                    <div className="panel-form-actions">
                        <button className="panel-btn panel-btn--primary" onClick={criarPagamento}>Criar</button>
                        <button className="panel-btn" onClick={() => setShowForm(false)}>Cancelar</button>
                    </div>
                </div>
            )}

            {/* Listas */}
            <div className="panel-list">
                {tab === 'orcamentos' && orcamentos.map((o) => (
                    <div key={o.id} className="panel-card">
                        <div className="panel-card-header">
                            <span className="panel-card-title">{fmt(o.valor)}</span>
                            <span className="panel-card-badge" style={{ background: o.status === 'APROVADO' ? '#10b981' : '#94a3b8' }}>{o.status}</span>
                        </div>
                        {o.observacoes && <p className="panel-card-desc">{o.observacoes}</p>}
                        <div className="panel-card-meta">
                            <span>#{o.id}</span>
                            <button onClick={() => excluir('orcamentos', o.id)}><Trash2 size={12} /></button>
                        </div>
                    </div>
                ))}

                {tab === 'despesas' && despesas.map((d) => (
                    <div key={d.id} className="panel-card">
                        <div className="panel-card-header">
                            <span className="panel-card-title">{d.descricao}</span>
                            <span className="panel-card-badge" style={{ background: '#ef4444' }}>{fmt(d.valor)}</span>
                        </div>
                        <div className="panel-card-meta">
                            <span>{d.categoria} · {d.data}</span>
                            <button onClick={() => excluir('despesas', d.id)}><Trash2 size={12} /></button>
                        </div>
                    </div>
                ))}

                {tab === 'pagamentos' && pagamentos.map((p) => (
                    <div key={p.id} className="panel-card">
                        <div className="panel-card-header">
                            <span className="panel-card-title">Lote #{p.lote_id}</span>
                            <span className="panel-card-badge" style={{ background: p.status === 'PAGO' ? '#10b981' : '#f59e0b' }}>{p.status}</span>
                        </div>
                        <div className="panel-card-meta">
                            <span>{fmt(p.valor_pago || 0)} / {fmt(p.valor_total || 0)}</span>
                            <button onClick={() => excluir('pagamentos', p.id)}><Trash2 size={12} /></button>
                        </div>
                    </div>
                ))}

                {((tab === 'orcamentos' && orcamentos.length === 0) ||
                    (tab === 'despesas' && despesas.length === 0) ||
                    (tab === 'pagamentos' && pagamentos.length === 0)) && (
                        <div className="panel-empty">
                            <DollarSign size={24} />
                            <p>Nenhum registro</p>
                        </div>
                    )}
            </div>
        </div>
    );
}
