/**
 * ConfrontacoesPanel — Confrontações do lote (visão cliente)
 * O cliente pode adicionar/editar confrontantes com os dados necessários
 * para a Declaração de Respeito de Limites (doc 03).
 *
 * Campos por confrontante:
 *   #CONFRONTANTE — Nome completo
 *   #CONF_CPF — CPF
 *   #CONF_IMOVEL — Nome do imóvel
 *   #CONF_MATRICULA — Matrícula
 *   Direção (Norte, Sul, Leste, Oeste)
 */
import { useState, useEffect } from 'react';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import {
    Users, Loader2, Plus, Trash2, Save, CheckCircle,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight, AlertCircle
} from 'lucide-react';

interface Confrontante {
    nome: string;
    cpf: string;
    imovel: string;
    matricula: string;
    direcao: string;
}

const EMPTY_CONF: Confrontante = {
    nome: '', cpf: '', imovel: '', matricula: '', direcao: 'norte',
};

const DIR_ICON: Record<string, React.ReactNode> = {
    norte: <ArrowUp size={12} />,
    sul: <ArrowDown size={12} />,
    leste: <ArrowRight size={12} />,
    oeste: <ArrowLeft size={12} />,
};

const DIRECOES = ['norte', 'sul', 'leste', 'oeste'];

export default function ConfrontacoesPanel() {
    const { loteAtual } = useApp();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [confrontantes, setConfrontantes] = useState<Confrontante[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!loteAtual) return;
        const load = async () => {
            setLoading(true);
            try {
                const res = await apiClient.getConfrontacoes(loteAtual.id);
                if (res.data) {
                    const raw = (res.data as any).vizinhos || res.data || [];
                    if (Array.isArray(raw) && raw.length > 0) {
                        setConfrontantes(raw.map((c: any) => ({
                            nome: c.nome_confrontante || c.nome || '',
                            cpf: c.cpf_confrontante || c.cpf || '',
                            imovel: c.imovel_confrontante || c.imovel || '',
                            matricula: c.matricula_confrontante || c.matricula || '',
                            direcao: c.direcao || c.lado || 'norte',
                        })));
                    }
                }
                if (res.error) setError(res.error);
            } catch {
                setError('Erro ao carregar');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [loteAtual?.id]);

    const addConfrontante = () => {
        setConfrontantes([...confrontantes, { ...EMPTY_CONF }]);
    };

    const removeConfrontante = (idx: number) => {
        setConfrontantes(confrontantes.filter((_, i) => i !== idx));
    };

    const updateConfrontante = (idx: number, field: keyof Confrontante, value: string) => {
        setConfrontantes(confrontantes.map((c, i) =>
            i === idx ? { ...c, [field]: value } : c
        ));
    };

    const salvar = async () => {
        if (!loteAtual) return;
        setSaving(true);
        setSaved(false);
        try {
            const vizinhos = confrontantes.map((c) => ({
                lote_id: String(loteAtual.id),
                nome_vizinho: c.nome,
                lado: c.direcao,
                cpf_confrontante: c.cpf,
                imovel_confrontante: c.imovel,
                matricula_confrontante: c.matricula,
            }));
            await apiClient.salvarConfrontacoes(loteAtual.id, vizinhos as any);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError('Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    if (!loteAtual) {
        return (
            <div className="panel">
                <div className="panel-empty">
                    <Users size={24} />
                    <p>Selecione um lote para ver confrontações</p>
                </div>
            </div>
        );
    }

    if (loading) return <div className="panel-loading"><Loader2 size={20} className="spin" /> Carregando...</div>;

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>👥 Confrontações</h3>
                <button className="panel-btn panel-btn--sm" onClick={addConfrontante}>
                    <Plus size={14} />
                </button>
            </div>

            <div className="panel-info" style={{ fontSize: '.75rem' }}>
                <AlertCircle size={12} /> Dados dos confrontantes para a Declaração de Respeito de Limites (doc 03).
                Cada confrontante gera uma declaração separada.
            </div>

            {error && <div className="panel-error">{error}</div>}

            {confrontantes.length === 0 ? (
                <div className="panel-empty">
                    <Users size={20} />
                    <p>Nenhum confrontante cadastrado</p>
                    <button className="panel-btn panel-btn--primary" onClick={addConfrontante}>
                        <Plus size={14} /> Adicionar Confrontante
                    </button>
                </div>
            ) : (
                <div className="panel-list">
                    {confrontantes.map((c, i) => (
                        <div key={i} className="panel-card" style={{ padding: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontWeight: 600, fontSize: '.8rem' }}>
                                    {DIR_ICON[c.direcao]} Confrontante {i + 1}
                                </span>
                                <button className="panel-btn panel-btn--danger panel-btn--sm" onClick={() => removeConfrontante(i)}>
                                    <Trash2 size={12} />
                                </button>
                            </div>

                            <label className="panel-label">Direção</label>
                            <select className="panel-input" value={c.direcao}
                                onChange={(e) => updateConfrontante(i, 'direcao', e.target.value)}>
                                {DIRECOES.map((d) => (
                                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                                ))}
                            </select>

                            <label className="panel-label">Nome Completo *</label>
                            <input className="panel-input" placeholder="#CONFRONTANTE"
                                value={c.nome} onChange={(e) => updateConfrontante(i, 'nome', e.target.value)} />

                            <label className="panel-label">CPF *</label>
                            <input className="panel-input" placeholder="#CONF_CPF"
                                value={c.cpf} onChange={(e) => updateConfrontante(i, 'cpf', e.target.value)} />

                            <label className="panel-label">Nome do Imóvel</label>
                            <input className="panel-input" placeholder="#CONF_IMOVEL"
                                value={c.imovel} onChange={(e) => updateConfrontante(i, 'imovel', e.target.value)} />

                            <label className="panel-label">Matrícula</label>
                            <input className="panel-input" placeholder="#CONF_MATRICULA"
                                value={c.matricula} onChange={(e) => updateConfrontante(i, 'matricula', e.target.value)} />
                        </div>
                    ))}

                    <button className="panel-btn panel-btn--primary panel-btn--full" onClick={salvar} disabled={saving}>
                        {saved
                            ? <><CheckCircle size={14} /> Salvo!</>
                            : saving
                                ? <><Loader2 size={14} className="spin" /> Salvando...</>
                                : <><Save size={14} /> Salvar Confrontantes</>}
                    </button>
                </div>
            )}
        </div>
    );
}
