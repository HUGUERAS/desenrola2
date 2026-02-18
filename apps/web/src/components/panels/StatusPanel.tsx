/**
 * StatusPanel — Acompanhamento do processo pelo cliente
 */
import { useApp } from '../../pages/AppShell';
import { Clock, CheckCircle, Circle, Loader2 } from 'lucide-react';

interface Step {
    id: string;
    label: string;
    icon: string;
    status: 'done' | 'current' | 'pending';
}

export default function StatusPanel() {
    const { loteAtual } = useApp();

    if (!loteAtual) {
        return (
            <div className="panel">
                <div className="panel-empty">
                    <Clock size={24} />
                    <p>Selecione um lote para acompanhar</p>
                </div>
            </div>
        );
    }

    const loteStatus = loteAtual.status || 'PENDENTE';

    const steps: Step[] = [
        { id: 'cadastro', label: 'Cadastro Realizado', icon: '📝', status: 'done' },
        {
            id: 'dados',
            label: 'Dados Preenchidos',
            icon: '👤',
            status: loteStatus === 'PENDENTE' ? 'current' : 'done',
        },
        {
            id: 'desenho',
            label: 'Área Desenhada',
            icon: '✏️',
            status: ['PENDENTE'].includes(loteStatus) ? 'pending'
                : loteStatus === 'DESENHO' ? 'current' : 'done',
        },
        {
            id: 'validacao',
            label: 'Em Validação',
            icon: '🔍',
            status: ['PENDENTE', 'DESENHO'].includes(loteStatus) ? 'pending'
                : loteStatus === 'VALIDACAO' ? 'current' : 'done',
        },
        {
            id: 'aprovado',
            label: 'Aprovado',
            icon: '✅',
            status: loteStatus === 'APROVADO' ? 'done' : 'pending',
        },
    ];

    const completedCount = steps.filter((s) => s.status === 'done').length;
    const progress = Math.round((completedCount / steps.length) * 100);

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>⏳ Acompanhar</h3>
            </div>

            <div className="panel-info">
                <span>Lote #{loteAtual.id}</span>
            </div>

            <div className="panel-progress">
                <div className="panel-progress-bar">
                    <div className="panel-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="panel-progress-text">{progress}% concluído</span>
            </div>

            <div className="panel-timeline">
                {steps.map((step, i) => (
                    <div key={step.id} className={`panel-timeline-step panel-timeline-step--${step.status}`}>
                        <div className="panel-timeline-icon">
                            {step.status === 'done' ? (
                                <CheckCircle size={16} className="text-success" />
                            ) : step.status === 'current' ? (
                                <Loader2 size={16} className="spin text-accent" />
                            ) : (
                                <Circle size={16} />
                            )}
                        </div>
                        <div className="panel-timeline-content">
                            <span className="panel-timeline-label">
                                {step.icon} {step.label}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {loteStatus === 'REJEITADO' && (
                <div className="panel-error" style={{ marginTop: 12 }}>
                    ❌ Seu desenho foi rejeitado. Corrija e reenvie.
                </div>
            )}

            {loteStatus === 'APROVADO' && (
                <div className="panel-success" style={{ marginTop: 12 }}>
                    🎉 Processo concluído! As peças técnicas estão sendo geradas.
                </div>
            )}
        </div>
    );
}
