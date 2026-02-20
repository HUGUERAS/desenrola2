/**
 * VizinhosPanel — Identificar vizinhos automaticos + edicao manual + DirectionCompass
 * Incorpora padroes do Carretel NeighborWizard:
 *   - Grid compass+resumo, badges tipo (Lote Interno/Externo), secao detalhes
 *   - Separador antes do salvar, empty state com CTA
 * Mantem: apiClient real, Supabase, DirectionCompass, formatCPF
 */
import { useState } from 'react';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import {
    Search, Save, Loader2, Pencil, Plus, X, MapPin, Users, Zap,
    CheckCircle2, Compass, AlertTriangle,
} from 'lucide-react';
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
type Direcao = typeof DIRECOES[number];

const DIRECAO_LABELS: Record<string, string> = {
    norte: 'Norte',
    sul: 'Sul',
    leste: 'Leste',
    oeste: 'Oeste',
};

function getVizinhosPorDirecao(vizinhos: Vizinho[]): Record<string, Vizinho[]> {
    const porDir: Record<string, Vizinho[]> = { norte: [], sul: [], leste: [], oeste: [] };
    vizinhos.forEach((v) => {
        const d = v.direcao?.toLowerCase() || 'norte';
        if (porDir[d]) porDir[d].push(v);
    });
    return porDir;
}

function getTipoVizinho(v: Vizinho): 'lote_interno' | 'pessoa_externa' {
    return v.lote_id && !v.lote_id.startsWith('manual') ? 'lote_interno' : 'pessoa_externa';
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
            setError('Falha ao processar analise espacial');
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
                toast.success('Confrontacoes salvas com sucesso');
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
            toast.error('Nome obrigatorio');
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
        toast.success('Confrontacao manual adicionada');
    };

    const removeVizinho = (dir: string) => {
        setVizinhos((prev) => prev.filter((v) => v.direcao !== dir));
        setEditingDir(null);
    };

    const vizinhosPorDir = getVizinhosPorDirecao(vizinhos);
    const highlightedDirections = DIRECOES.filter((d) => (vizinhosPorDir[d]?.length ?? 0) > 0) as any[];
    const totalDetectados = vizinhos.length;
    const totalInterno = vizinhos.filter(v => getTipoVizinho(v) === 'lote_interno').length;
    const totalExterno = totalDetectados - totalInterno;

    if (!loteAtual) {
        return (
            <div className="panel">
                <div className="panel-empty py-20">
                    <MapPin size={48} className="text-titanium-200 mb-4" />
                    <p className="text-titanium-500 text-sm">Selecione um lote no mapa</p>
                    <p className="text-titanium-400 text-xs mt-1">para identificar confrontantes</p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel">
            {/* Header */}
            <div className="panel-header mb-4">
                <div className="flex flex-col">
                    <h3 className="flex items-center gap-2">
                        <Compass size={18} className="text-primary" /> Identificar Vizinhos
                    </h3>
                    <span className="text-[10px] text-titanium-400 font-bold uppercase tracking-widest mt-0.5">
                        Lote #{loteAtual.id}
                    </span>
                </div>
            </div>

            {/* Descricao do algoritmo */}
            <div style={{ padding: '0 12px', marginBottom: '16px' }}>
                <p className="text-[11px] text-titanium-500 leading-relaxed">
                    Utilize o algoritmo LOT-BY-LOT para detectar automaticamente as confrontacoes
                    baseado na adjacencia espacial das geometrias.
                </p>
            </div>

            {/* Botao de identificar */}
            <div style={{ padding: '0 12px', marginBottom: '16px' }}>
                <Button
                    variant="primary"
                    className="w-full py-5 shadow-lg shadow-primary/20"
                    onClick={identificar}
                    disabled={loading}
                    icon={loading ? undefined : 'search'}
                >
                    {loading ? (
                        <><Loader2 size={16} className="spin mr-2" /> Analisando Geometrias...</>
                    ) : (
                        'Identificar Vizinhos'
                    )}
                </Button>
            </div>

            {error && <div className="panel-error mb-4" style={{ margin: '0 12px 12px' }}>{error}</div>}

            {/* Resultado: Compass + Resumo */}
            {vizinhos.length > 0 && (
                <div className="space-y-4" style={{ padding: '0 12px' }}>

                    {/* Compass + Stats Card */}
                    <Card className="bg-titanium-900 overflow-hidden relative border-none" hover={false}>
                        <div className="absolute top-0 right-0 p-3 opacity-5">
                            <Zap size={90} className="text-white" />
                        </div>
                        <div className="relative z-10 flex flex-col items-center py-6">
                            <DirectionCompass highlightedDirections={highlightedDirections} size="md" />
                            <div className="mt-4 flex gap-6">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{totalDetectados}</div>
                                    <div className="text-[9px] uppercase text-titanium-400 font-bold tracking-wider">Total</div>
                                </div>
                                <div className="text-center border-l border-titanium-700 pl-6">
                                    <div className="text-2xl font-bold text-primary-400">{totalInterno}</div>
                                    <div className="text-[9px] uppercase text-titanium-400 font-bold tracking-wider">Internos</div>
                                </div>
                                <div className="text-center border-l border-titanium-700 pl-6">
                                    <div className="text-2xl font-bold text-warning-400">{totalExterno}</div>
                                    <div className="text-[9px] uppercase text-titanium-400 font-bold tracking-wider">Externos</div>
                                </div>
                            </div>
                            {resultado?.metadados?.tempo_execucao_ms && (
                                <div className="mt-2 text-[10px] text-titanium-500">
                                    Processado em {resultado.metadados.tempo_execucao_ms}ms
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Resumo por Direcao */}
                    <div>
                        <h4 className="text-[10px] font-black uppercase text-titanium-500 tracking-widest mb-3 px-1">
                            Resumo das Confrontacoes
                        </h4>
                        <div className="space-y-2">
                            {DIRECOES.map(dir => {
                                const list = vizinhosPorDir[dir] || [];
                                const v = list[0];
                                return (
                                    <div key={dir} className="flex items-center justify-between p-3 border border-titanium-200 rounded-lg bg-white">
                                        <div>
                                            <div className="font-semibold text-xs uppercase text-titanium-700">{DIRECAO_LABELS[dir]}</div>
                                            {v ? (
                                                <div className="text-[11px] text-titanium-500 mt-0.5">
                                                    {v.numero > 0 ? `Lote ${v.numero} - ` : ''}{v.cliente?.nome || 'N/I'}
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-titanium-400 italic mt-0.5">Nao detectado</div>
                                            )}
                                        </div>
                                        {v ? (
                                            <CheckCircle2 size={18} className="text-success flex-shrink-0" />
                                        ) : (
                                            <div className="w-[18px] h-[18px] rounded-full border-2 border-titanium-200 flex-shrink-0" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Detalhes das Confrontacoes */}
                    <div>
                        <h4 className="text-[10px] font-black uppercase text-titanium-500 tracking-widest mb-1 px-1">
                            Detalhes das Confrontacoes
                        </h4>
                        <p className="text-[10px] text-titanium-400 mb-3 px-1">
                            Revise e edite as informacoes detectadas automaticamente
                        </p>

                        <div className="space-y-3">
                            {DIRECOES.map((dir) => {
                                const list = vizinhosPorDir[dir] || [];
                                const isEditing = editingDir === dir;

                                return (
                                    <div key={dir}>
                                        {list.length > 0 && !isEditing ? (
                                            list.map((v, i) => {
                                                const tipo = getTipoVizinho(v);
                                                return (
                                                    <Card key={i} className="p-3 border-l-4 border-l-primary group" hover={false}>
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1">
                                                                {/* Direction + Type badges */}
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Badge variant="info" size="sm" className="uppercase">{dir}</Badge>
                                                                    <Badge
                                                                        variant={tipo === 'lote_interno' ? 'success' : 'warning'}
                                                                        size="sm"
                                                                    >
                                                                        {tipo === 'lote_interno' ? 'Lote Interno' : 'Externo'}
                                                                    </Badge>
                                                                </div>
                                                                {/* Owner info */}
                                                                <div className="font-bold text-sm text-titanium-900 group-hover:text-primary transition-colors">
                                                                    {v.cliente?.nome || 'Proprietario nao identificado'}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-[10px] text-titanium-500 mt-1 flex-wrap">
                                                                    {v.cliente?.cpf && (
                                                                        <span className="font-mono">CPF: {v.cliente.cpf}</span>
                                                                    )}
                                                                    {tipo === 'lote_interno' && v.numero > 0 && (
                                                                        <span>Lote #{v.numero}</span>
                                                                    )}
                                                                    {v.distancia_metros && (
                                                                        <span className="text-titanium-300">{v.distancia_metros.toFixed(1)}m</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
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
                                                );
                                            })
                                        ) : isEditing ? (
                                            <Card className="p-4 bg-titanium-50 border-titanium-200" hover={false}>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Badge variant="info" size="sm" className="uppercase">{dir}</Badge>
                                                    <span className="text-[10px] text-titanium-500 font-bold">
                                                        {list.length > 0 ? 'Editando' : 'Adicionar manualmente'}
                                                    </span>
                                                </div>
                                                <div className="space-y-3">
                                                    <Input
                                                        label="Nome do Proprietario"
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
                                        ) : (
                                            /* Direcao sem vizinho: botao de adicionar */
                                            <div className="flex items-center justify-between p-3 border border-dashed border-titanium-200 rounded-lg">
                                                <div>
                                                    <Badge variant="default" size="sm" className="uppercase">{dir}</Badge>
                                                    <span className="text-[11px] text-titanium-400 italic ml-2">Nenhum vizinho detectado</span>
                                                </div>
                                                <button
                                                    onClick={() => setEditingDir(dir)}
                                                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                                                >
                                                    <Plus size={12} /> Adicionar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Separator + Save */}
                    <div className="border-t border-titanium-200 pt-4 mt-4">
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="flex-1"
                                disabled={saving || saved}
                                onClick={() => {
                                    setVizinhos([]);
                                    setResultado(null);
                                    setSaved(false);
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                className="flex-1 py-3 font-bold uppercase tracking-widest text-xs"
                                onClick={salvar}
                                disabled={saving || saved || vizinhos.length === 0}
                                icon={saved ? 'check' : (saving ? undefined : 'save')}
                            >
                                {saved ? 'Salvo' : (saving ? <><Loader2 size={14} className="spin mr-1" /> Salvando...</> : 'Salvar Confrontacoes')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
