/**
 * FinanceiroPanel — Orçamentos, Despesas e Pagamentos
 * Incorpora padrões do Carretel FinancialManagement:
 *   - Status icons, auto-status por datas, empty states com CTA
 *   - Layout compacto tipo tabela, pendente calculado, progress bars
 * Mantém: 3 abas, apiClient real, Supabase, edit/create support
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import {
    DollarSign, Plus, Trash2, Loader2, X, Calendar, User,
    TrendingUp, TrendingDown, Receipt, Pencil, Wallet,
    Clock, CheckCircle2, AlertTriangle, CircleDot,
} from 'lucide-react';
import { Button, Card, Input, Select, Badge, CardHeader, CardBody, Textarea } from '../ui/Components';

type Tab = 'orcamentos' | 'despesas' | 'pagamentos';
type FinancialStatus = 'pago' | 'parcial' | 'pendente' | 'atrasado' | 'aprovado' | 'rejeitado';

const fmtDate = (d?: string) => {
    if (!d) return '---';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const STATUS_CONFIG: Record<FinancialStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'default'; icon: React.ReactNode }> = {
    pago:      { label: 'Pago',      variant: 'success', icon: <CheckCircle2 size={12} /> },
    parcial:   { label: 'Parcial',   variant: 'warning', icon: <CircleDot size={12} /> },
    pendente:  { label: 'Pendente',  variant: 'info',    icon: <Clock size={12} /> },
    atrasado:  { label: 'Atrasado',  variant: 'error',   icon: <AlertTriangle size={12} /> },
    aprovado:  { label: 'Aprovado',  variant: 'success', icon: <CheckCircle2 size={12} /> },
    rejeitado: { label: 'Rejeitado', variant: 'error',   icon: <X size={12} /> },
};

function calculateStatus(valorTotal: number, valorPago: number, dataVencimento?: string, statusManual?: string): FinancialStatus {
    if (statusManual === 'APROVADO') return 'aprovado';
    if (statusManual === 'REJEITADO') return 'rejeitado';
    if (valorPago >= valorTotal && valorTotal > 0) return 'pago';
    if (valorPago > 0) return 'parcial';
    if (dataVencimento) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const venc = new Date(dataVencimento + 'T00:00:00');
        if (venc < hoje) return 'atrasado';
    }
    return 'pendente';
}

export default function FinanceiroPanel() {
    const { projetoAtual } = useApp();
    const [tab, setTab] = useState<Tab>('orcamentos');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [loadErrors, setLoadErrors] = useState<Partial<Record<Tab, string>>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [orcamentos, setOrcamentos] = useState<any[]>([]);
    const [despesas, setDespesas] = useState<any[]>([]);
    const [pagamentos, setPagamentos] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);

    // Form state
    const emptyDespesa = { descricao: '', valor: '', data: '', data_vencimento: '', categoria: 'SERVICO', observacoes: '' };
    const emptyPagamento = { lote_id: '', valor_total: '', valor_pago: '', data_vencimento: '', data_pagamento: '', metodo: 'PIX', observacoes: '' };
    const emptyOrcamento = { valor: '', observacoes: '', cliente_nome: '', data_vencimento: '', status: 'PENDENTE' };

    const [formDespesa, setFormDespesa] = useState(emptyDespesa);
    const [formPagamento, setFormPagamento] = useState(emptyPagamento);
    const [formOrcamento, setFormOrcamento] = useState(emptyOrcamento);

    const getErrorMessage = (result: any, fallback: string) => {
        if (!result) return fallback;
        if (typeof result === 'string') return result;
        if (typeof result.error === 'string' && result.error.trim()) return result.error;
        if (typeof result.reason?.message === 'string' && result.reason.message.trim()) return result.reason.message;
        return fallback;
    };

    const hasPersistedEntity = (data: unknown) =>
        !!data && typeof data === 'object' && 'id' in data && (data as { id?: unknown }).id != null;

    const hasOkFlag = (data: unknown) =>
        !!data && typeof data === 'object' && (data as { ok?: unknown }).ok === true;

    const carregar = async () => {
        const pid = projetoAtual?.id;
        if (!pid) {
            setOrcamentos([]);
            setDespesas([]);
            setPagamentos([]);
            setLoadErrors({});
            setError('');
            return;
        }

        setLoading(true);
        setError('');
        setLoadErrors({});

        try {
            const [orc, desp, pag] = await Promise.allSettled([
                apiClient.getOrcamentos(pid),
                apiClient.getDespesas(pid),
                apiClient.getPagamentos(pid),
            ]);

            const nextLoadErrors: Partial<Record<Tab, string>> = {};

            if (orc.status === 'fulfilled') {
                if (orc.value.error) {
                    nextLoadErrors.orcamentos = getErrorMessage(orc.value, 'Erro ao carregar orcamentos');
                } else {
                    setOrcamentos(orc.value.data || []);
                }
            } else {
                nextLoadErrors.orcamentos = getErrorMessage(orc, 'Erro ao carregar orcamentos');
            }

            if (desp.status === 'fulfilled') {
                if (desp.value.error) {
                    nextLoadErrors.despesas = getErrorMessage(desp.value, 'Erro ao carregar despesas');
                } else {
                    setDespesas(desp.value.data || []);
                }
            } else {
                nextLoadErrors.despesas = getErrorMessage(desp, 'Erro ao carregar despesas');
            }

            if (pag.status === 'fulfilled') {
                if (pag.value.error) {
                    nextLoadErrors.pagamentos = getErrorMessage(pag.value, 'Erro ao carregar pagamentos');
                } else {
                    setPagamentos(pag.value.data || []);
                }
            } else {
                nextLoadErrors.pagamentos = getErrorMessage(pag, 'Erro ao carregar pagamentos');
            }

            setLoadErrors(nextLoadErrors);
            if (Object.keys(nextLoadErrors).length > 0) {
                setError('Alguns dados financeiros nao puderam ser carregados.');
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Erro ao carregar dados financeiros'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carregar(); }, [projetoAtual?.id]);

    const hoje = new Date().toISOString().split('T')[0];

    // Totais
    const totalDespesas = despesas.reduce((s, d) => s + (d.valor || 0), 0);
    const totalPago = pagamentos.reduce((s, p) => s + (p.valor_pago || 0), 0);
    const totalOrcado = orcamentos.reduce((s, o) => s + (o.valor || 0), 0);
    const totalPendente = totalOrcado - totalPago;
    const saldo = totalPago - totalDespesas;
    const pctRecebido = totalOrcado > 0 ? Math.min(Math.round((totalPago / totalOrcado) * 100), 100) : 0;

    // Contadores de atrasados
    const qtdAtrasados = [
        ...pagamentos.filter((p) => calculateStatus(p.valor_total || 0, p.valor_pago || 0, p.data_vencimento) === 'atrasado'),
        ...despesas.filter((d) => calculateStatus(d.valor || 0, 0, d.data_vencimento) === 'atrasado'),
    ].length;

    const fecharModal = () => {
        setShowModal(false);
        setEditId(null);
        setFormErrors({});
        setFormDespesa(emptyDespesa);
        setFormOrcamento(emptyOrcamento);
        setFormPagamento(emptyPagamento);
    };

    const abrirNovo = () => {
        fecharModal();
        setShowModal(true);
    };

    // --- Editar ---
    const editarOrcamento = (o: any) => {
        setEditId(o.id);
        setFormOrcamento({
            valor: String(o.valor || ''),
            observacoes: o.observacoes || '',
            cliente_nome: o.cliente_nome || '',
            data_vencimento: o.data_vencimento || '',
            status: o.status || 'PENDENTE',
        });
        setTab('orcamentos');
        setShowModal(true);
    };

    const editarDespesa = (d: any) => {
        setEditId(d.id);
        setFormDespesa({
            descricao: d.descricao || '',
            valor: String(d.valor || ''),
            data: d.data || '',
            data_vencimento: d.data_vencimento || '',
            categoria: d.categoria || 'SERVICO',
            observacoes: d.observacoes || '',
        });
        setTab('despesas');
        setShowModal(true);
    };

    const editarPagamento = (p: any) => {
        setEditId(p.id);
        setFormPagamento({
            lote_id: String(p.lote_id || ''),
            valor_total: String(p.valor_total || ''),
            valor_pago: String(p.valor_pago || ''),
            data_vencimento: p.data_vencimento || '',
            data_pagamento: p.data_pagamento || '',
            metodo: p.metodo_pagamento || 'PIX',
            observacoes: p.observacoes || '',
        });
        setTab('pagamentos');
        setShowModal(true);
    };

    const validarOrcamento = () => {
        const nextErrors: Record<string, string> = {};
        const valor = Number(formOrcamento.valor);
        if (!projetoAtual?.id) nextErrors.orcamento_projeto = 'Projeto obrigatorio.';
        if (!Number.isFinite(valor) || valor <= 0) nextErrors.orcamento_valor = 'Informe um valor maior que zero.';
        setFormErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const validarDespesa = () => {
        const nextErrors: Record<string, string> = {};
        const valor = Number(formDespesa.valor);
        if (!projetoAtual?.id) nextErrors.despesa_projeto = 'Projeto obrigatorio.';
        if (!formDespesa.descricao.trim()) nextErrors.despesa_descricao = 'Descricao obrigatoria.';
        if (!Number.isFinite(valor) || valor <= 0) nextErrors.despesa_valor = 'Informe um valor maior que zero.';
        setFormErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const validarPagamento = () => {
        const nextErrors: Record<string, string> = {};
        const loteId = Number.parseInt(formPagamento.lote_id, 10);
        const valorTotal = Number(formPagamento.valor_total);
        const valorPago = formPagamento.valor_pago === '' ? 0 : Number(formPagamento.valor_pago);
        if (!Number.isInteger(loteId) || loteId <= 0) nextErrors.pagamento_lote_id = 'ID do lote deve ser inteiro positivo.';
        if (!Number.isFinite(valorTotal) || valorTotal <= 0) nextErrors.pagamento_valor_total = 'Informe um valor total maior que zero.';
        if (!Number.isFinite(valorPago) || valorPago < 0) nextErrors.pagamento_valor_pago = 'Valor pago nao pode ser negativo.';
        setFormErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    // --- Salvar (criar ou atualizar) ---
    const salvarOrcamento = async () => {
        if (!validarOrcamento()) return;
        setSaving(true);
        try {
            const data = {
                projeto_id: projetoAtual?.id,
                valor: Number(formOrcamento.valor),
                observacoes: formOrcamento.observacoes,
                cliente_nome: formOrcamento.cliente_nome,
                data_vencimento: formOrcamento.data_vencimento,
            };
            if (editId) {
                const res = await apiClient.updateOrcamento(editId, { valor: data.valor, observacoes: data.observacoes, status: formOrcamento.status });
                if (res.error) {
                    toast.error(res.error);
                    return;
                }
                if (!hasPersistedEntity(res.data)) {
                    toast.error('Servidor nao confirmou a atualizacao do orcamento.');
                    return;
                }
                toast.success('Orcamento atualizado');
            } else {
                const res = await apiClient.createOrcamento(data);
                if (res.error) {
                    toast.error(res.error);
                    return;
                }
                if (!hasPersistedEntity(res.data)) {
                    toast.error('Servidor nao confirmou a criacao do orcamento.');
                    return;
                }
                toast.success('Orcamento criado');
            }
            fecharModal();
            await carregar();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Erro ao salvar orcamento'));
        } finally {
            setSaving(false);
        }
    };

    const salvarDespesa = async () => {
        if (!validarDespesa()) return;
        if (!projetoAtual) return;
        setSaving(true);
        try {
            const data = {
                projeto_id: projetoAtual.id,
                descricao: formDespesa.descricao.trim(),
                valor: Number(formDespesa.valor),
                data: formDespesa.data || hoje,
                data_vencimento: formDespesa.data_vencimento,
                categoria: formDespesa.categoria,
                observacoes: formDespesa.observacoes,
            };
            if (editId) {
                const res = await apiClient.updateDespesa(editId, data);
                if (res.error) {
                    toast.error(res.error);
                    return;
                }
                if (!hasPersistedEntity(res.data)) {
                    toast.error('Servidor nao confirmou a atualizacao da despesa.');
                    return;
                }
                toast.success('Despesa atualizada');
            } else {
                const res = await apiClient.createDespesa(data);
                if (res.error) {
                    toast.error(res.error);
                    return;
                }
                if (!hasPersistedEntity(res.data)) {
                    toast.error('Servidor nao confirmou a criacao da despesa.');
                    return;
                }
                toast.success('Despesa criada');
            }
            fecharModal();
            await carregar();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Erro ao salvar despesa'));
        } finally {
            setSaving(false);
        }
    };

    const salvarPagamento = async () => {
        if (!validarPagamento()) return;
        setSaving(true);
        try {
            if (editId) {
                const res = await apiClient.updatePagamento(editId, {
                    valor_total: Number(formPagamento.valor_total),
                    valor_pago: formPagamento.valor_pago === '' ? 0 : Number(formPagamento.valor_pago),
                    data_pagamento: formPagamento.data_pagamento,
                    metodo_pagamento: formPagamento.metodo,
                    observacoes: formPagamento.observacoes,
                });
                if (res.error) {
                    toast.error(res.error);
                    return;
                }
                if (!hasPersistedEntity(res.data)) {
                    toast.error('Servidor nao confirmou a atualizacao do pagamento.');
                    return;
                }
                toast.success('Pagamento atualizado');
            } else {
                const res = await apiClient.createPagamento({
                    lote_id: Number.parseInt(formPagamento.lote_id, 10),
                    valor_total: Number(formPagamento.valor_total),
                    valor_pago: formPagamento.valor_pago === '' ? 0 : Number(formPagamento.valor_pago),
                    data_vencimento: formPagamento.data_vencimento,
                    metodo_pagamento: formPagamento.metodo,
                    observacoes: formPagamento.observacoes,
                });
                if (res.error) {
                    toast.error(res.error);
                    return;
                }
                if (!hasPersistedEntity(res.data)) {
                    toast.error('Servidor nao confirmou o registro do pagamento.');
                    return;
                }
                toast.success('Pagamento registrado');
            }
            fecharModal();
            await carregar();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Erro ao salvar pagamento'));
        } finally {
            setSaving(false);
        }
    };

    const excluir = async (tipo: Tab, id: number) => {
        if (!confirm('Deseja realmente excluir este registro?')) return;
        try {
            if (tipo === 'despesas') {
                const res = await apiClient.deleteDespesa(id);
                if (res.error) throw new Error(res.error);
                if (!hasOkFlag(res.data)) throw new Error('Servidor nao confirmou a exclusao da despesa.');
            }
            if (tipo === 'orcamentos') {
                const res = await apiClient.deleteOrcamento(id);
                if (res.error) throw new Error(res.error);
                if (!hasOkFlag(res.data)) throw new Error('Servidor nao confirmou a exclusao do orcamento.');
            }
            if (tipo === 'pagamentos') {
                const res = await apiClient.deletePagamento(id);
                if (res.error) throw new Error(res.error);
                if (!hasOkFlag(res.data)) throw new Error('Servidor nao confirmou a exclusao do pagamento.');
            }
            toast.success('Registro excluido');
            await carregar();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Erro ao excluir'));
        }
    };

    // --- Render helpers ---
    const StatusBadge = ({ status }: { status: FinancialStatus }) => {
        const cfg = STATUS_CONFIG[status];
        return (
            <Badge variant={cfg.variant} size="sm" className="inline-flex items-center gap-1">
                {cfg.icon}
                {cfg.label}
            </Badge>
        );
    };

    const EmptyState = ({ icon: IconComp, message, tabName }: { icon: React.ElementType; message: string; tabName: string }) => (
        <div className="panel-empty py-12">
            <IconComp size={40} className="mx-auto text-titanium-200 mb-3" />
            <p className="text-titanium-500 text-sm mb-4">{message}</p>
            <Button variant="primary" size="sm" onClick={abrirNovo} icon="plus">
                Criar Primeiro {tabName}
            </Button>
        </div>
    );

    if (loading) return <div className="panel-loading"><Loader2 size={20} className="spin" /> Carregando financas...</div>;

    return (
        <div className="panel">
            <div className="panel-header">
                <div className="flex flex-col">
                    <h3 className="flex items-center gap-2"><DollarSign size={16} /> Financeiro</h3>
                    {projetoAtual && (
                        <span className="text-[10px] text-titanium-400 font-bold uppercase tracking-widest mt-0.5">
                            {projetoAtual.nome}
                        </span>
                    )}
                </div>
                <Button variant="primary" size="sm" onClick={abrirNovo} icon="plus">
                    Novo
                </Button>
            </div>

            {/* Dashboard Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '0 12px', marginBottom: '12px' }}>
                <Card className="p-3 bg-primary/5 border-primary/20" hover={false}>
                    <div className="flex items-center gap-2 mb-1">
                        <Receipt size={14} className="text-primary" />
                        <span className="text-[9px] uppercase font-bold text-titanium-500 tracking-wider">Total</span>
                    </div>
                    <div className="text-base font-bold text-titanium-900">{fmt(totalOrcado)}</div>
                    <div className="text-[10px] text-titanium-400 mt-0.5">Soma dos orcamentos</div>
                </Card>
                <Card className="p-3 bg-success/5 border-success/20" hover={false}>
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 size={14} className="text-success" />
                        <span className="text-[9px] uppercase font-bold text-titanium-500 tracking-wider">Recebido</span>
                    </div>
                    <div className="text-base font-bold text-success-600">{fmt(totalPago)}</div>
                    <div className="text-[10px] text-titanium-400 mt-0.5">Pagamentos confirmados</div>
                </Card>
                <Card className="p-3 bg-warning/5 border-warning/20" hover={false}>
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-warning" />
                        <span className="text-[9px] uppercase font-bold text-titanium-500 tracking-wider">Pendente</span>
                    </div>
                    <div className="text-base font-bold text-warning-600">{fmt(Math.max(totalPendente, 0))}</div>
                    <div className="text-[10px] text-titanium-400 mt-0.5">Aguardando pagamento</div>
                </Card>
                <Card className={`p-3 ${saldo >= 0 ? 'bg-success/5 border-success/20' : 'bg-error/5 border-error/20'}`} hover={false}>
                    <div className="flex items-center gap-2 mb-1">
                        <Wallet size={14} className={saldo >= 0 ? 'text-success' : 'text-error'} />
                        <span className="text-[9px] uppercase font-bold text-titanium-500 tracking-wider">Saldo</span>
                    </div>
                    <div className={`text-base font-bold ${saldo >= 0 ? 'text-success-600' : 'text-error-600'}`}>{fmt(saldo)}</div>
                    <div className="text-[10px] text-titanium-400 mt-0.5">Recebido - Despesas</div>
                </Card>
            </div>

            {/* Barra de Progresso */}
            {totalOrcado > 0 && (
                <div style={{ padding: '0 12px', marginBottom: '12px' }}>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-titanium-500 uppercase tracking-wider">
                            Recebimento
                        </span>
                        <span className="text-[10px] font-bold text-titanium-600">
                            {pctRecebido}% do total
                        </span>
                    </div>
                    <div style={{
                        height: '6px',
                        background: 'var(--border)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${pctRecebido}%`,
                            background: pctRecebido >= 100 ? '#10b981' : pctRecebido > 50 ? '#3b82f6' : '#f59e0b',
                            borderRadius: '3px',
                            transition: 'width 0.5s ease',
                        }} />
                    </div>
                    {qtdAtrasados > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle size={10} className="text-error" />
                            <span className="text-[10px] font-bold text-error">{qtdAtrasados} atrasado{qtdAtrasados > 1 ? 's' : ''}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Tabs */}
            <div className="panel-tabs mb-4">
                <button className={`panel-tab ${tab === 'orcamentos' ? 'active' : ''}`} onClick={() => setTab('orcamentos')}>
                    Orcamentos ({orcamentos.length})
                </button>
                <button className={`panel-tab ${tab === 'despesas' ? 'active' : ''}`} onClick={() => setTab('despesas')}>
                    Despesas ({despesas.length})
                </button>
                <button className={`panel-tab ${tab === 'pagamentos' ? 'active' : ''}`} onClick={() => setTab('pagamentos')}>
                    Pagamentos ({pagamentos.length})
                </button>
            </div>

            {error && <div className="panel-error mb-4">{error}</div>}
            {loadErrors[tab] && <div className="panel-error mb-4">{loadErrors[tab]}</div>}

            {/* Records List */}
            <div className="space-y-3" style={{ padding: '0 12px' }}>

                {/* ========== ORCAMENTOS ========== */}
                {tab === 'orcamentos' && (
                    orcamentos.length > 0 ? orcamentos.map((o) => {
                        const status = calculateStatus(o.valor || 0, 0, o.data_vencimento, o.status);
                        return (
                            <Card key={o.id} className="p-3" hover={false}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg font-bold text-titanium-900">{fmt(o.valor)}</span>
                                            <StatusBadge status={status} />
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-titanium-500 flex-wrap">
                                            <span className="flex items-center gap-1"><User size={11} /> {o.cliente_nome || 'N/I'}</span>
                                            <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(o.criado_em?.split('T')[0])}</span>
                                            {o.data_vencimento && (
                                                <span className={`flex items-center gap-1 ${status === 'atrasado' ? 'text-error font-bold' : 'text-warning'}`}>
                                                    <Clock size={11} /> Vence {fmtDate(o.data_vencimento)}
                                                </span>
                                            )}
                                        </div>
                                        {o.observacoes && <p className="mt-2 text-[11px] text-titanium-500 border-l-2 border-titanium-200 pl-2">{o.observacoes}</p>}
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                        <button onClick={() => editarOrcamento(o)} className="text-titanium-400 hover:text-primary transition-colors p-1"><Pencil size={14} /></button>
                                        <button onClick={() => excluir('orcamentos', o.id)} className="text-titanium-400 hover:text-error transition-colors p-1"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </Card>
                        );
                    }) : (
                        <EmptyState icon={DollarSign} message="Nenhum orcamento registrado" tabName="Orcamento" />
                    )
                )}

                {/* ========== DESPESAS ========== */}
                {tab === 'despesas' && (
                    despesas.length > 0 ? despesas.map((d) => {
                        const status = calculateStatus(d.valor || 0, 0, d.data_vencimento);
                        return (
                            <Card key={d.id} className="p-3" hover={false}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-titanium-900">{d.descricao}</span>
                                            <span className="font-bold text-error-600 ml-2 whitespace-nowrap">{fmt(d.valor)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-titanium-500 flex-wrap">
                                            <Badge variant="default" size="sm">{d.categoria}</Badge>
                                            <StatusBadge status={status} />
                                            {d.data && <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(d.data)}</span>}
                                            {d.data_vencimento && (
                                                <span className={`flex items-center gap-1 ${status === 'atrasado' ? 'text-error font-bold' : ''}`}>
                                                    <Clock size={11} /> Venc. {fmtDate(d.data_vencimento)}
                                                </span>
                                            )}
                                        </div>
                                        {d.observacoes && <p className="mt-1.5 text-[11px] text-titanium-500 italic">"{d.observacoes}"</p>}
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                        <button onClick={() => editarDespesa(d)} className="text-titanium-400 hover:text-primary transition-colors p-1"><Pencil size={14} /></button>
                                        <button onClick={() => excluir('despesas', d.id)} className="text-titanium-400 hover:text-error transition-colors p-1"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </Card>
                        );
                    }) : (
                        <EmptyState icon={TrendingDown} message="Nenhuma despesa registrada" tabName="Despesa" />
                    )
                )}

                {/* ========== PAGAMENTOS ========== */}
                {tab === 'pagamentos' && (
                    pagamentos.length > 0 ? pagamentos.map((p) => {
                        const status = calculateStatus(p.valor_total || 0, p.valor_pago || 0, p.data_vencimento);
                        const pctPago = p.valor_total > 0 ? Math.round(((p.valor_pago || 0) / p.valor_total) * 100) : 0;
                        const pendente = Math.max((p.valor_total || 0) - (p.valor_pago || 0), 0);
                        return (
                            <Card key={p.id} className="p-3" hover={false}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-titanium-900">Lote #{p.lote_id}</span>
                                            <StatusBadge status={status} />
                                        </div>
                                        {/* Valores: Total / Pago / Pendente */}
                                        <div className="grid grid-cols-3 gap-2 text-xs mb-2 mt-2">
                                            <div>
                                                <div className="text-[9px] uppercase font-bold text-titanium-400 tracking-wider">Total</div>
                                                <div className="font-bold text-titanium-800">{fmt(p.valor_total || 0)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] uppercase font-bold text-titanium-400 tracking-wider">Pago</div>
                                                <div className="font-bold text-success-600">{fmt(p.valor_pago || 0)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] uppercase font-bold text-titanium-400 tracking-wider">Pendente</div>
                                                <div className="font-bold text-warning-600">{fmt(pendente)}</div>
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div style={{
                                            height: '4px',
                                            background: 'var(--border)',
                                            borderRadius: '2px',
                                            overflow: 'hidden',
                                            marginBottom: '4px',
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${pctPago}%`,
                                                background: pctPago >= 100 ? '#10b981' : pctPago > 0 ? '#f59e0b' : '#e2e8f0',
                                                borderRadius: '2px',
                                                transition: 'width 0.4s ease',
                                            }} />
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] text-titanium-500">
                                            <span className="font-bold">{pctPago}% pago</span>
                                            <span className="text-[10px] uppercase font-bold tracking-tight text-titanium-400">{p.metodo_pagamento || 'PIX'}</span>
                                            {p.data_vencimento && (
                                                <span className={`flex items-center gap-1 ${status === 'atrasado' ? 'text-error font-bold' : ''}`}>
                                                    <Calendar size={10} /> Venc. {fmtDate(p.data_vencimento)}
                                                </span>
                                            )}
                                            {p.data_pagamento && (
                                                <span className="text-success flex items-center gap-1">
                                                    <CheckCircle2 size={10} /> {fmtDate(p.data_pagamento)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                        <button onClick={() => editarPagamento(p)} className="text-titanium-400 hover:text-primary transition-colors p-1"><Pencil size={14} /></button>
                                        <button onClick={() => excluir('pagamentos', p.id)} className="text-titanium-400 hover:text-error transition-colors p-1"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </Card>
                        );
                    }) : (
                        <EmptyState icon={Receipt} message="Nenhum pagamento registrado" tabName="Pagamento" />
                    )
                )}
            </div>

            {/* Modal Novo / Editar */}
            {showModal && (
                <div className="panel-modal-overlay" onClick={fecharModal}>
                    <Card className="max-w-md w-full mx-4 overflow-hidden" hover={false} onClick={e => e.stopPropagation()}>
                        <CardHeader className="flex justify-between items-center bg-titanium-50 px-6 py-4">
                            <div>
                                <h4 className="text-lg font-bold text-titanium-900">
                                    {editId ? 'Editar' : 'Novo'}{' '}
                                    {tab === 'orcamentos' ? 'Orcamento' :
                                        tab === 'despesas' ? 'Despesa' : 'Pagamento'}
                                </h4>
                                <p className="text-[11px] text-titanium-500 mt-0.5">
                                    {editId
                                        ? 'Atualize as informacoes do registro financeiro'
                                        : 'Adicione um novo registro de pagamento ou recebimento'}
                                </p>
                            </div>
                            <button className="text-titanium-400 hover:text-titanium-600" onClick={fecharModal}>
                                <X size={20} />
                            </button>
                        </CardHeader>

                        <CardBody className="p-6">
                            {tab === 'orcamentos' && (
                                <div className="space-y-4">
                                    <Input label="Nome do Cliente" placeholder="Ex: Joao da Silva" icon="user" value={formOrcamento.cliente_nome} onChange={e => setFormOrcamento({ ...formOrcamento, cliente_nome: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Valor (R$)" type="number" placeholder="0,00" icon="dollar" value={formOrcamento.valor} error={formErrors.orcamento_valor} onChange={e => { setFormOrcamento({ ...formOrcamento, valor: e.target.value }); setFormErrors(prev => ({ ...prev, orcamento_valor: '' })); }} />
                                        <Input label="Vencimento" type="date" value={formOrcamento.data_vencimento} onChange={e => setFormOrcamento({ ...formOrcamento, data_vencimento: e.target.value })} />
                                    </div>
                                    {formErrors.orcamento_projeto && <p className="text-error text-sm -mt-2">{formErrors.orcamento_projeto}</p>}
                                    {editId && (
                                        <Select label="Status" options={[
                                            { value: 'PENDENTE', label: 'Pendente' },
                                            { value: 'APROVADO', label: 'Aprovado' },
                                            { value: 'REJEITADO', label: 'Rejeitado' },
                                        ]} value={formOrcamento.status} onChange={e => setFormOrcamento({ ...formOrcamento, status: e.target.value })} />
                                    )}
                                    <Textarea label="Observacoes" placeholder="Detalhes do orcamento..." value={formOrcamento.observacoes} onChange={e => setFormOrcamento({ ...formOrcamento, observacoes: e.target.value })} rows={3} />
                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button variant="secondary" size="sm" onClick={fecharModal}>Cancelar</Button>
                                        <Button variant="primary" size="sm" isLoading={saving} disabled={saving} onClick={salvarOrcamento}>{editId ? 'Atualizar' : 'Criar Orcamento'}</Button>
                                    </div>
                                </div>
                            )}

                            {tab === 'despesas' && (
                                <div className="space-y-4">
                                    <Input label="Descricao" placeholder="Ex: Marcos de concreto" icon="file" value={formDespesa.descricao} error={formErrors.despesa_descricao} onChange={e => { setFormDespesa({ ...formDespesa, descricao: e.target.value }); setFormErrors(prev => ({ ...prev, despesa_descricao: '' })); }} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Valor (R$)" type="number" placeholder="0,00" icon="dollar" value={formDespesa.valor} error={formErrors.despesa_valor} onChange={e => { setFormDespesa({ ...formDespesa, valor: e.target.value }); setFormErrors(prev => ({ ...prev, despesa_valor: '' })); }} />
                                        <Select label="Categoria" options={[
                                            { value: 'SERVICO', label: 'Servico' },
                                            { value: 'MATERIAL', label: 'Material' },
                                            { value: 'TRANSPORTE', label: 'Transporte' },
                                            { value: 'IMPOSTO', label: 'Imposto/Taxa' },
                                            { value: 'OUTROS', label: 'Outros' }
                                        ]} value={formDespesa.categoria} onChange={e => setFormDespesa({ ...formDespesa, categoria: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Data" type="date" value={formDespesa.data} onChange={e => setFormDespesa({ ...formDespesa, data: e.target.value })} />
                                        <Input label="Vencimento" type="date" value={formDespesa.data_vencimento} onChange={e => setFormDespesa({ ...formDespesa, data_vencimento: e.target.value })} />
                                    </div>
                                    {formErrors.despesa_projeto && <p className="text-error text-sm -mt-2">{formErrors.despesa_projeto}</p>}
                                    <Textarea label="Observacoes" placeholder="NF, local de compra..." value={formDespesa.observacoes} onChange={e => setFormDespesa({ ...formDespesa, observacoes: e.target.value })} rows={2} />
                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button variant="secondary" size="sm" onClick={fecharModal}>Cancelar</Button>
                                        <Button variant="primary" size="sm" isLoading={saving} disabled={saving} onClick={salvarDespesa}>{editId ? 'Atualizar' : 'Criar Despesa'}</Button>
                                    </div>
                                </div>
                            )}

                            {tab === 'pagamentos' && (
                                <div className="space-y-4">
                                    <Input label="ID do Lote" icon="file" placeholder="Ex: 42" value={formPagamento.lote_id} error={formErrors.pagamento_lote_id} onChange={e => { setFormPagamento({ ...formPagamento, lote_id: e.target.value }); setFormErrors(prev => ({ ...prev, pagamento_lote_id: '' })); }} disabled={!!editId} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Valor Total (R$)" type="number" placeholder="0,00" value={formPagamento.valor_total} error={formErrors.pagamento_valor_total} onChange={e => { setFormPagamento({ ...formPagamento, valor_total: e.target.value }); setFormErrors(prev => ({ ...prev, pagamento_valor_total: '' })); }} />
                                        <Input label="Valor Pago (R$)" type="number" placeholder="0,00" value={formPagamento.valor_pago} error={formErrors.pagamento_valor_pago} onChange={e => { setFormPagamento({ ...formPagamento, valor_pago: e.target.value }); setFormErrors(prev => ({ ...prev, pagamento_valor_pago: '' })); }} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Vencimento" type="date" value={formPagamento.data_vencimento} onChange={e => setFormPagamento({ ...formPagamento, data_vencimento: e.target.value })} />
                                        <Input label="Data Pagamento" type="date" value={formPagamento.data_pagamento} onChange={e => setFormPagamento({ ...formPagamento, data_pagamento: e.target.value })} />
                                    </div>
                                    <Select label="Metodo" options={[
                                        { value: 'PIX', label: 'PIX' },
                                        { value: 'BOLETO', label: 'Boleto' },
                                        { value: 'CARTAO', label: 'Cartao de Credito' },
                                        { value: 'TRANSFERENCIA', label: 'Transferencia' },
                                        { value: 'DINHEIRO', label: 'Dinheiro' }
                                    ]} value={formPagamento.metodo} onChange={e => setFormPagamento({ ...formPagamento, metodo: e.target.value })} />
                                    <Textarea label="Observacoes" placeholder="Comprovante, referencia..." value={formPagamento.observacoes} onChange={e => setFormPagamento({ ...formPagamento, observacoes: e.target.value })} rows={2} />
                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button variant="secondary" size="sm" onClick={fecharModal}>Cancelar</Button>
                                        <Button variant="primary" size="sm" isLoading={saving} disabled={saving} onClick={salvarPagamento}>{editId ? 'Atualizar' : 'Registrar Pagamento'}</Button>
                                    </div>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </div>
            )}
        </div>
    );
}
