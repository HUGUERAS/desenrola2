/**
 * VizinhosPanel — Identificar vizinhos automáticos + salvar confrontações
 */
import { useState } from 'react';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { Search, Save, Loader2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

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

const DIRECAO_ICON: Record<string, React.ReactNode> = {
    norte: <ArrowUp size={14} />,
    sul: <ArrowDown size={14} />,
    leste: <ArrowRight size={14} />,
    oeste: <ArrowLeft size={14} />,
};

export default function VizinhosPanel() {
    const { loteAtual } = useApp();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [resultado, setResultado] = useState<ResultadoVizinhos | null>(null);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    const identificar = async () => {
        if (!loteAtual) return;
        setLoading(true);
        setError('');
        setResultado(null);
        setSaved(false);
        try {
            const res = await apiClient.identificarVizinhos(loteAtual.id);
            if (res.data) setResultado(res.data as ResultadoVizinhos);
            if (res.error) setError(res.error);
        } catch {
            setError('Erro ao identificar vizinhos');
        } finally {
            setLoading(false);
        }
    };

    const salvar = async () => {
        if (!loteAtual || !resultado) return;
        setSaving(true);
        setError('');
        try {
            const res = await apiClient.salvarConfrontacoes(
                loteAtual.id,
                resultado.vizinhos.map((v) => ({
                    lote_id: v.lote_id,
                    numero: v.numero,
                    direcao: v.direcao,
                }))
            );
            if (res.error) setError(res.error);
            else setSaved(true);
        } catch {
            setError('Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    if (!loteAtual) {
        return (
            <div className="panel">
                <div className="panel-empty">
                    <Search size={24} />
                    <p>Selecione um lote para identificar vizinhos</p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>🔍 Vizinhos</h3>
            </div>

            <div className="panel-info">
                <span>Lote #{loteAtual.id} — {loteAtual.nome_cliente}</span>
            </div>

            <button
                className="panel-btn panel-btn--primary panel-btn--full"
                onClick={identificar}
                disabled={loading}
            >
                {loading ? <><Loader2 size={14} className="spin" /> Buscando...</> : <><Search size={14} /> Identificar Vizinhos</>}
            </button>

            {error && <div className="panel-error">{error}</div>}

            {resultado && (
                <>
                    <div className="panel-result-header" style={{ marginTop: 12 }}>
                        <span>{resultado.total_vizinhos} vizinho(s) encontrado(s)</span>
                        {resultado.metadados?.tempo_execucao_ms && (
                            <span className="panel-meta-time">{resultado.metadados.tempo_execucao_ms}ms</span>
                        )}
                    </div>

                    {['norte', 'sul', 'leste', 'oeste'].map((dir) => {
                        const vizinhos = resultado.vizinhos_por_direcao[dir] || [];
                        if (vizinhos.length === 0) return null;
                        return (
                            <div key={dir} className="panel-section">
                                <h4 className="panel-dir-label">
                                    {DIRECAO_ICON[dir]} {dir.charAt(0).toUpperCase() + dir.slice(1)}
                                </h4>
                                {vizinhos.map((v, i) => (
                                    <div key={i} className="panel-vizinho-card">
                                        <span className="panel-vizinho-num">Lote {v.numero}</span>
                                        {v.cliente && <span className="panel-vizinho-nome">{v.cliente.nome}</span>}
                                        {v.distancia_metros && (
                                            <span className="panel-vizinho-dist">{v.distancia_metros.toFixed(1)}m</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })}

                    <button
                        className="panel-btn panel-btn--success panel-btn--full"
                        onClick={salvar}
                        disabled={saving || saved}
                        style={{ marginTop: 8 }}
                    >
                        {saved ? '✓ Salvo' : saving ? <><Loader2 size={14} className="spin" /> Salvando...</> : <><Save size={14} /> Salvar Confrontações</>}
                    </button>
                </>
            )}
        </div>
    );
}
