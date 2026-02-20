/**
 * FinanceiroPanel — Orçamentos, Despesas e Pagamentos
 * Premium UI with Carretel integration (due dates, customer names)
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { DollarSign, Plus, Trash2, Loader2, X, Calendar, User, FileText, TrendingUp, TrendingDown, Receipt } from 'lucide-react';
import { Button, Card, Input, Select, Badge, CardHeader, CardBody, CardFooter, Textarea } from '../ui/Components';

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
    const [formDespesa, setFormDespesa] = useState({ descricao: '', valor: '', data: '', data_vencimento: '', categoria: 'SERVICO', observacoes: '' });
    const [formPagamento, setFormPagamento] = useState({ lote_id: '', valor_total: '', data_vencimento: '', metodo: 'PIX' });
    const [formOrcamento, setFormOrcamento] = useState({ valor: '', observacoes: '', cliente_nome: '', data_vencimento: '' });

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

    const getStatusInfo = (item: any, tipo: 'pagamento' | 'despesa' | 'orcamento') => {
        if (tipo === 'orcamento') {
            return {
                label: item.status || 'PENDENTE',
                variant: item.status === 'APROVADO' ? 'success' as const : 'default' as const
            };
        }

        const total = tipo === 'pagamento' ? (item.valor_total || 0) : (item.valor || 0);
        const pago = tipo === 'pagamento' ? (item.valor_pago || 0) : 0;
        const dataVenc = item.data_vencimento || item.data;

        if (tipo === 'pagamento' && pago >= total) return { label: 'PAGO', variant: 'success' as const };
        if (tipo === 'pagamento' && pago > 0) return { label: 'PARCIAL', variant: 'warning' as const };
        if (dataVenc && dataVenc < hoje) return { label: 'ATRASADO', variant: 'error' as const };
        return { label: 'PENDENTE', variant: 'info' as const };
    };

    const qtdAtrasados = [
        ...pagamentos.filter((p) => getStatusInfo(p, 'pagamento').label === 'ATRASADO'),
        ...despesas.filter((d) => getStatusInfo(d, 'despesa').label === 'ATRASADO'),
    ].length;

    const fecharModal = () => {
        setShowModal(false);
        setFormDespesa({ descricao: '', valor: '', data: '', data_vencimento: '', categoria: 'SERVICO', observacoes: '' });
        setFormOrcamento({ valor: '', observacoes: '', cliente_nome: '', data_vencimento: '' });
        setFormPagamento({ lote_id: '', valor_total: '', data_vencimento: '', metodo: 'PIX' });
    };

    const criarDespesa = async () => {
        if (!projetoAtual) return;
        try {
            await apiClient.createDespesa({
                projeto_id: projetoAtual.id,
                descricao: formDespesa.descricao,
                valor: parseFloat(formDespesa.valor),
                data: formDespesa.data || hoje,
                data_vencimento: formDespesa.data_vencimento,
                categoria: formDespesa.categoria,
                observacoes: formDespesa.observacoes
            });
            fecharModal();
            toast.success('Despesa criada');
            carregar();
        } catch {
            toast.error('Erro ao criar despesa');
        }
    };

    const criarOrcamento = async () => {
        try {
            await apiClient.createOrcamento({
                projeto_id: projetoAtual?.id,
                valor: parseFloat(formOrcamento.valor),
                observacoes: formOrcamento.observacoes,
                cliente_nome: formOrcamento.cliente_nome,
                data_vencimento: formOrcamento.data_vencimento
            });
            fecharModal();
            toast.success('Orçamento criado');
            carregar();
        } catch {
            toast.error('Erro ao criar orçamento');
        }
    };

    const criarPagamento = async () => {
        try {
            await apiClient.createPagamento({
                lote_id: parseInt(formPagamento.lote_id),
                valor_total: parseFloat(formPagamento.valor_total),
                data_vencimento: formPagamento.data_vencimento,
                metodo_pagamento: formPagamento.metodo,
            });
            fecharModal();
            toast.success('Pagamento registrado');
            carregar();
        } catch {
            toast.error('Erro ao criar pagamento');
        }
    };

    const excluir = async (tipo: Tab, id: number) => {
        if (!confirm('Deseja realmente excluir este registro?')) return;
        try {
            if (tipo === 'despesas') await apiClient.deleteDespesa(id);
            if (tipo === 'orcamentos') await apiClient.deleteOrcamento(id);
            if (tipo === 'pagamentos') await apiClient.deletePagamento(id);
            toast.success('Registro excluído');
            carregar();
        } catch {
            toast.error('Erro ao excluir registro');
        }
    };

    if (loading) return <div className="panel-loading"><Loader2 size={20} className="spin" /> Carregando finanças...</div>;

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>💰 Financeiro</h3>
                <Button variant="primary" size="sm" onClick={() => setShowModal(true)} icon="plus">
                    Novo
                </Button>
            </div>

            {/* Dash Analytics */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <Card className="p-4 bg-primary/5 border-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={16} className="text-primary" />
                        <span className="text-[10px] uppercase font-bold text-titanium-500 tracking-wider">Total Orçado</span>
                    </div>
                    <div className="text-lg font-bold text-titanium-900">{fmt(totalOrcado)}</div>
                </Card>
                <Card className="p-4 bg-success/5 border-success/20">
                    <div className="flex items-center gap-2 mb-1">
                        <Receipt size={16} className="text-success" />
                        <span className="text-[10px] uppercase font-bold text-titanium-500 tracking-wider">Recebido</span>
                    </div>
                    <div className="text-lg font-bold text-success-600">{fmt(totalPago)}</div>
                </Card>
                <Card className="p-4 bg-error/5 border-error/20">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingDown size={16} className="text-error" />
                        <span className="text-[10px] uppercase font-bold text-titanium-500 tracking-wider">Despesas</span>
                    </div>
                    <div className="text-lg font-bold text-error-600">{fmt(totalDespesas)}</div>
                </Card>
                <Card className="p-4 bg-warning/5 border-warning/20">
                    <div className="flex items-center gap-2 mb-1">
                        <Calendar size={16} className="text-warning" />
                        <span className="text-[10px] uppercase font-bold text-titanium-500 tracking-wider">Atrasados</span>
                    </div>
                    <div className="text-lg font-bold text-warning-600">{qtdAtrasados} pendentes</div>
                </Card>
            </div>

            {/* Tabs Navigation */}
            <div className="panel-tabs mb-4">
                {(['orcamentos', 'despesas', 'pagamentos'] as Tab[]).map((t) => (
                    <button
                        key={t}
                        className={`panel-tab ${tab === t ? 'active' : ''}`}
                        onClick={() => setTab(t)}
                    >
                        {t === 'orcamentos' ? `Orçamentos` :
                            t === 'despesas' ? `Despesas` :
                                `Pagamentos`}
                    </button>
                ))}
            </div>

            {error && <div className="panel-error mb-4">{error}</div>}

            {/* List View with Cards */}
            <div className="space-y-3">
                {tab === 'orcamentos' && (
                    orcamentos.length > 0 ? orcamentos.map((o) => {
                        const status = getStatusInfo(o, 'orcamento');
                        return (
                            <Card key={o.id} className="p-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg font-bold text-titanium-900">{fmt(o.valor)}</span>
                                            <Badge variant={status.variant} size="sm">{status.label}</Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-titanium-500">
                                            <span className="flex items-center gap-1"><User size={12} /> {o.cliente_nome || 'Cliente não informado'}</span>
                                            <span className="flex items-center gap-1"><Calendar size={12} /> {o.criado_em ? new Date(o.criado_em).toLocaleDateString('pt-BR') : '—'}</span>
                                        </div>
                                        {o.observacoes && <p className="mt-2 text-xs text-titanium-600 border-l-2 border-titanium-200 pl-2">{o.observacoes}</p>}
                                    </div>
                                    <button onClick={() => excluir('orcamentos', o.id)} className="text-titanium-400 hover:text-error transition-colors p-1">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </Card>
                        );
                    }) : (
                        <div className="panel-empty py-12">
                            <DollarSign size={48} className="mx-auto text-titanium-200 mb-2" />
                            <p>Nenhum orçamento registrado para este projeto</p>
                        </div>
                    )
                )}

                {tab === 'despesas' && (
                    despesas.length > 0 ? despesas.map((d) => {
                        const status = getStatusInfo(d, 'despesa');
                        return (
                            <Card key={d.id} className="p-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-titanium-900">{d.descricao}</span>
                                            <span className="font-bold text-error-600">{fmt(d.valor)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-titanium-500 mb-2">
                                            <Badge variant="default" size="sm">{d.categoria}</Badge>
                                            <span className="flex items-center gap-1"><Calendar size={12} /> {d.data || d.data_vencimento || '—'}</span>
                                            <Badge variant={status.variant} size="sm">{status.label}</Badge>
                                        </div>
                                        {d.observacoes && <p className="text-[11px] text-titanium-500 italic">"{d.observacoes}"</p>}
                                    </div>
                                    <button onClick={() => excluir('despesas', d.id)} className="text-titanium-400 hover:text-error transition-colors p-1 ml-2">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </Card>
                        );
                    }) : (
                        <div className="panel-empty py-12">
                            <TrendingDown size={48} className="mx-auto text-titanium-200 mb-2" />
                            <p>Nenhuma despesa registrada</p>
                        </div>
                    )
                )}

                {tab === 'pagamentos' && (
                    pagamentos.length > 0 ? pagamentos.map((p) => {
                        const status = getStatusInfo(p, 'pagamento');
                        return (
                            <Card key={p.id} className="p-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-titanium-900">Lote #{p.lote_id}</span>
                                            <span className="font-bold text-success-600">{fmt(p.valor_pago || 0)}</span>
                                        </div>
                                        <div className="text-xs text-titanium-500 mb-2">
                                            Recebido de total {fmt(p.valor_total || 0)}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-titanium-500">
                                            <Badge variant={status.variant} size="sm">{status.label}</Badge>
                                            <span className="flex items-center gap-1"><Calendar size={12} /> {p.data_pagamento || p.data_vencimento || '—'}</span>
                                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-tight">{p.metodo_pagamento || 'PIX'}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => excluir('pagamentos', p.id)} className="text-titanium-400 hover:text-error transition-colors p-1 ml-2">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </Card>
                        );
                    }) : (
                        <div className="panel-empty py-12">
                            <Receipt size={48} className="mx-auto text-titanium-200 mb-2" />
                            <p>Nenhum pagamento registrado</p>
                        </div>
                    )
                )}
            </div>

            {/* Modal Novo Registro */}
            {showModal && (
                <div className="panel-modal-overlay" onClick={fecharModal}>
                    <Card className="max-w-md w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <CardHeader className="flex justify-between items-center bg-titanium-50 px-6 py-4">
                            <h4 className="text-lg font-bold text-titanium-900">
                                {tab === 'orcamentos' ? 'Novo Orçamento' :
                                    tab === 'despesas' ? 'Nova Despesa' : 'Registrar Pagamento'}
                            </h4>
                            <button className="text-titanium-400 hover:text-titanium-600" onClick={fecharModal}>
                                <X size={20} />
                            </button>
                        </CardHeader>

                        <CardBody className="p-6">
                            {tab === 'orcamentos' && (
                                <div className="space-y-4">
                                    <Input label="Nome do Cliente" placeholder="Ex: João da Silva" icon="user" value={formOrcamento.cliente_nome} onChange={e => setFormOrcamento({ ...formOrcamento, cliente_nome: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Valor (R$)" type="number" placeholder="0,00" icon="dollar" value={formOrcamento.valor} onChange={e => setFormOrcamento({ ...formOrcamento, valor: e.target.value })} />
                                        <Input label="Validade" type="date" value={formOrcamento.data_vencimento} onChange={e => setFormOrcamento({ ...formOrcamento, data_vencimento: e.target.value })} />
                                    </div>
                                    <Textarea label="Observações" placeholder="Detalhes específicos..." value={formOrcamento.observacoes} onChange={e => setFormOrcamento({ ...formOrcamento, observacoes: e.target.value })} rows={3} />
                                    <Button className="w-full mt-4" onClick={criarOrcamento}>Criar Orçamento</Button>
                                </div>
                            )}

                            {tab === 'despesas' && (
                                <div className="space-y-4">
                                    <Input label="Descrição" placeholder="Ex: Marcos de concreto" icon="file" value={formDespesa.descricao} onChange={e => setFormDespesa({ ...formDespesa, descricao: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Valor (R$)" type="number" placeholder="0,00" icon="dollar" value={formDespesa.valor} onChange={e => setFormDespesa({ ...formDespesa, valor: e.target.value })} />
                                        <Select label="Categoria" options={[
                                            { value: 'SERVICO', label: 'Serviço' },
                                            { value: 'MATERIAL', label: 'Material' },
                                            { value: 'TRANSPORTE', label: 'Transporte' },
                                            { value: 'IMPOSTO', label: 'Imposto/Taxa' },
                                            { value: 'OUTROS', label: 'Outros' }
                                        ]} value={formDespesa.categoria} onChange={e => setFormDespesa({ ...formDespesa, categoria: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Data da Compra" type="date" value={formDespesa.data} onChange={e => setFormDespesa({ ...formDespesa, data: e.target.value })} />
                                        <Input label="Vencimento" type="date" value={formDespesa.data_vencimento} onChange={e => setFormDespesa({ ...formDespesa, data_vencimento: e.target.value })} />
                                    </div>
                                    <Textarea label="Observações" placeholder="Local de compra, NF..." value={formDespesa.observacoes} onChange={e => setFormDespesa({ ...formDespesa, observacoes: e.target.value })} rows={2} />
                                    <Button className="w-full mt-4" onClick={criarDespesa}>Salvar Despesa</Button>
                                </div>
                            )}

                            {tab === 'pagamentos' && (
                                <div className="space-y-4">
                                    <Input label="ID do Lote" icon="file" placeholder="Ex: 42" value={formPagamento.lote_id} onChange={e => setFormPagamento({ ...formPagamento, lote_id: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Valor Total (R$)" type="number" placeholder="0,00" value={formPagamento.valor_total} onChange={e => setFormPagamento({ ...formPagamento, valor_total: e.target.value })} />
                                        <Input label="Vencimento" type="date" value={formPagamento.data_vencimento} onChange={e => setFormPagamento({ ...formPagamento, data_vencimento: e.target.value })} />
                                    </div>
                                    <Select label="Método Sugerido" options={[
                                        { value: 'PIX', label: 'PIX' },
                                        { value: 'BOLETO', label: 'Boleto' },
                                        { value: 'CARTAO', label: 'Cartão de Crédito' },
                                        { value: 'TRANSFERENCIA', label: 'Transferência' }
                                    ]} value={formPagamento.metodo} onChange={e => setFormPagamento({ ...formPagamento, metodo: e.target.value })} />
                                    <Button className="w-full mt-4" onClick={criarPagamento}>Gerar Registro</Button>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </div>
            )}
        </div>
    );
}

