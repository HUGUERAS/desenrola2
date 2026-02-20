/**
 * VizinhosPanel — Identificar vizinhos automáticos + edição manual + DirectionCompass
 * Premium UI with Carretel integration
 */
import { useState } from 'react';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { Search, Save, Loader2, Pencil, Plus, X, MapPin, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';
import DirectionCompass from '../DirectionCompass';
import { formatCPF } from '../../lib/format-utils';
import { Button, Card, Input, Badge, CardHeader, CardBody } from '../ui/Components';

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
                toast.success(`${(res.data as ResultadoVizinhos).vizinhos.length} vizinhos detectados`);
            }
        } catch {
            setError('Falha ao processar análise espacial');
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
                toast.success('Documentação de vizinhos salva');
            }
        } catch {
            setError('Erro ao persistir dados');
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
            toast.error('Nome obrigatório');
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
        toast.success('Confrontação manual adicionada');
    };

    const removeVizinho = (dir: string) => {
        setVizinhos((prev) => prev.filter((v) => v.direcao !== dir));
        setEditingDir(null);
    };

    const vizinhosPorDir = getVizinhosPorDirecao(vizinhos);
    const highlightedDirections = DIRECOES.filter((d) => (vizinhosPorDir[d]?.length ?? 0) > 0) as any[];

    if (!loteAtual) {
        return (
            <div className="panel">
                <div className="panel-empty py-20">
                    <MapPin size={48} className="text-titanium-200 mb-4" />
                    <p className="text-titanium-500">Selecione um lote no mapa<br />para identificar confrontantes</p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel">
            <div className="panel-header mb-4">
                <div className="flex flex-col">
                    <h3 className="flex items-center gap-2"><Users size={18} className="text-primary" /> Vizinhos</h3>
                    <span className="text-[10px] text-titanium-400 font-bold uppercase tracking-widest mt-0.5">Lote #{loteAtual.id}</span>
                </div>
            </div>

            <Button
                variant="primary"
                className="w-full mb-6 py-6 shadow-lg shadow-primary/20"
                onClick={identificar}
                disabled={loading}
                icon={loading ? undefined : 'search'}
            >
                {loading ? <><Loader2 size={16} className="spin mr-2" /> Analisando Geometrias...</> : 'Buscac Vizinhos Automáticos'}
            </Button>

            {error && <div className="panel-error mb-4">{error}</div>}

            {vizinhos.length > 0 && (
                <div className="space-y-6">
                    {/* Visual Analytics */}
                    <Card className="bg-titanium-900 overflow-hidden relative border-none">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Zap size={100} className="text-white" />
                        </div>
                        <div className="relative z-10 flex flex-col items-center py-8">
                            <DirectionCompass highlightedDirections={highlightedDirections} size="md" />
                            <div className="mt-4 flex gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{vizinhos.length}</div>
                                    <div className="text-[9px] uppercase text-titanium-400 font-bold">Confrontantes</div>
                                </div>
                                {resultado?.metadados?.tempo_execucao_ms && (
                                    <div className="text-center border-l border-titanium-800 pl-4">
                                        <div className="text-2xl font-bold text-success-400">{resultado.metadados.tempo_execucao_ms}ms</div>
                                        <div className="text-[9px] uppercase text-titanium-400 font-bold">Performance</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Direções Details */}
                    <div className="space-y-4">
                        {DIRECOES.map((dir) => {
                            const list = vizinhosPorDir[dir] || [];
                            const isEditing = editingDir === dir;

                            return (
                                <div key={dir}>
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <h4 className="flex items-center gap-2 text-[11px] font-black uppercase text-titanium-500 tracking-tighter">
                                            <span className={`w-2 h-2 rounded-full ${list.length > 0 ? 'bg-primary' : 'bg-titanium-200'}`}></span>
                                            {dir}
                                        </h4>
                                        {!isEditing && list.length === 0 && (
                                            <button
                                                onClick={() => setEditingDir(dir)}
                                                className="text-[10px] font-bold text-primary hover:underline"
                                            >
                                                + Adicionar
                                            </button>
                                        )}
                                    </div>

                                    {list.length > 0 && !isEditing ? (
                                        list.map((v, i) => (
                                            <Card key={i} className="p-3 border-l-4 border-l-primary group">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <div className="font-bold text-titanium-900 group-hover:text-primary transition-colors">
                                                            {v.cliente?.nome || 'Proprietário não identificado'}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-titanium-500">
                                                            {v.numero > 0 && <Badge variant="info" size="sm">Lote {v.numero}</Badge>}
                                                            {v.cliente?.cpf && <span>{v.cliente.cpf}</span>}
                                                            {v.distancia_metros && <span className="text-titanium-300">· {v.distancia_metros.toFixed(1)}m</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            className="p-1.5 hover:bg-titanium-100 rounded text-titanium-600"
                                                            onClick={() => {
                                                                setEditingDir(dir);
                                                                setManualForm({ nome: v.cliente?.nome || '', cpf: v.cliente?.cpf || '' });
                                                            }}
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            className="p-1.5 hover:bg-error/10 rounded text-error"
                                                            onClick={() => removeVizinho(dir)}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))
                                    ) : isEditing ? (
                                        <Card className="p-4 bg-titanium-50 border-titanium-200">
                                            <div className="space-y-3">
                                                <Input
                                                    label="Nome do Proprietário"
                                                    placeholder="Nome completo..."
                                                    value={manualForm.nome}
                                                    onChange={e => setManualForm({ ...manualForm, nome: e.target.value })}
                                                />
                                                <Input
                                                    label="CPF (opcional)"
                                                    placeholder="000.000.000-00"
                                                    value={manualForm.cpf}
                                                    onChange={e => setManualForm({ ...manualForm, cpf: formatCPF(e.target.value) })}
                                                />
                                                <div className="flex gap-2 pt-2">
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        className="flex-1"
                                                        onClick={() => list.length > 0 ? updateVizinhoFromForm(dir) : addManualVizinho(dir)}
                                                    >
                                                        {list.length > 0 ? 'Atualizar' : 'Adicionar'}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => { setEditingDir(null); setManualForm({ nome: '', cpf: '' }); }}
                                                    >
                                                        Cancelar
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>

                    <Button
                        variant="primary"
                        className="w-full mt-4 py-4 font-bold uppercase tracking-widest text-xs"
                        onClick={salvar}
                        disabled={saving || saved}
                        icon={saved ? undefined : (saving ? undefined : 'save')}
                    >
                        {saved ? '✓ Documentação Gerada' : (saving ? 'Salvando...' : 'Finalizar e Salvar')}
                    </Button>
                </div>
            )}
        </div>
    );
}

