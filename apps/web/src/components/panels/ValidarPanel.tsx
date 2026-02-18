/**
 * ValidarPanel — Validação topológica do lote selecionado
 */
import { useState } from 'react';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { CheckCircle, AlertTriangle, XCircle, Loader2, Play } from 'lucide-react';

interface ValidationResult {
    status?: string;
    is_valid?: boolean;
    can_proceed?: boolean;
    message?: string;
    warnings?: string[];
    errors?: string[];
    area_m2?: number;
    perimetro_m?: number;
}

export default function ValidarPanel() {
    const { loteAtual } = useApp();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ValidationResult | null>(null);
    const [sobreposicoes, setSobreposicoes] = useState<any[]>([]);
    const [error, setError] = useState('');

    const validar = async () => {
        if (!loteAtual) return;
        setLoading(true);
        setError('');
        setResult(null);
        setSobreposicoes([]);
        try {
            const [topoRes, sobRes] = await Promise.all([
                apiClient.validarTopologia(loteAtual.id),
                apiClient.getSobreposicoesLote(loteAtual.id),
            ]);

            if (topoRes.data) setResult(topoRes.data as ValidationResult);
            if (topoRes.error) setError(topoRes.error);
            if (sobRes.data) setSobreposicoes(sobRes.data as any[]);
        } catch {
            setError('Erro na validação');
        } finally {
            setLoading(false);
        }
    };

    if (!loteAtual) {
        return (
            <div className="panel">
                <div className="panel-empty">
                    <CheckCircle size={24} />
                    <p>Selecione um lote para validar</p>
                </div>
            </div>
        );
    }

    const statusIcon = result?.status === 'OK' || result?.is_valid
        ? <CheckCircle size={20} className="text-success" />
        : result?.status === 'WARN'
            ? <AlertTriangle size={20} className="text-warning" />
            : result?.status === 'FAIL' || result?.is_valid === false
                ? <XCircle size={20} className="text-error" />
                : null;

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>✅ Validar Topologia</h3>
            </div>

            <div className="panel-info">
                <span>Lote #{loteAtual.id} — {loteAtual.nome_cliente}</span>
            </div>

            <button
                className="panel-btn panel-btn--primary panel-btn--full"
                onClick={validar}
                disabled={loading}
            >
                {loading ? <><Loader2 size={14} className="spin" /> Validando...</> : <><Play size={14} /> Executar Validação</>}
            </button>

            {error && <div className="panel-error">{error}</div>}

            {result && (
                <div className="panel-result">
                    <div className="panel-result-header">
                        {statusIcon}
                        <span className="panel-result-status">{result.status || (result.is_valid ? 'OK' : 'FAIL')}</span>
                    </div>

                    {result.message && <p className="panel-result-msg">{result.message}</p>}

                    {result.area_m2 && (
                        <div className="panel-metrics">
                            <div className="panel-metric">
                                <span className="panel-metric-label">Área</span>
                                <span className="panel-metric-value">{result.area_m2.toLocaleString('pt-BR')} m²</span>
                            </div>
                            {result.perimetro_m && (
                                <div className="panel-metric">
                                    <span className="panel-metric-label">Perímetro</span>
                                    <span className="panel-metric-value">{result.perimetro_m.toLocaleString('pt-BR')} m</span>
                                </div>
                            )}
                        </div>
                    )}

                    {result.warnings && result.warnings.length > 0 && (
                        <div className="panel-alerts">
                            <h4>⚠️ Avisos</h4>
                            {result.warnings.map((w, i) => (
                                <div key={i} className="panel-alert panel-alert--warning">{w}</div>
                            ))}
                        </div>
                    )}

                    {result.errors && result.errors.length > 0 && (
                        <div className="panel-alerts">
                            <h4>❌ Erros</h4>
                            {result.errors.map((e, i) => (
                                <div key={i} className="panel-alert panel-alert--error">{e}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {sobreposicoes.length > 0 && (
                <div className="panel-section">
                    <h4>🔴 Sobreposições ({sobreposicoes.length})</h4>
                    {sobreposicoes.map((s, i) => (
                        <div key={i} className="panel-alert panel-alert--error">
                            Lote #{s.lote_id_2 || s.vizinho_id} — {s.area_sobreposta_m2?.toFixed(1) || '?'} m²
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
