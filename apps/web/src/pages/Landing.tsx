/**
 * Landing — Página inicial pública
 */
import { useNavigate } from 'react-router-dom';
import { Map } from 'lucide-react';

export default function Landing() {
    const navigate = useNavigate();

    return (
        <div className="landing">
            <div className="landing-bg" />
            <div className="landing-content">
                <div className="landing-hero">
                    <div className="landing-icon">
                        <Map size={48} />
                    </div>
                    <h1 className="landing-title">Desenrola</h1>
                    <p className="landing-subtitle">
                        Regularização fundiária digital.
                        <br />
                        Simples, rápido e profissional.
                    </p>

                    <div className="landing-actions">
                        <button
                            className="landing-btn landing-btn--primary"
                            onClick={() => navigate('/login')}
                        >
                            🚀 Entrar
                        </button>
                        <button
                            className="landing-btn landing-btn--secondary"
                            onClick={() => navigate('/signup')}
                        >
                            Criar Conta
                        </button>
                    </div>

                    <div className="landing-features">
                        <div className="landing-feature">
                            <span>📐</span>
                            <div>
                                <strong>SIRGAS 2000</strong>
                                <p>Padrão oficial brasileiro</p>
                            </div>
                        </div>
                        <div className="landing-feature">
                            <span>🗺️</span>
                            <div>
                                <strong>Mapa ArcGIS</strong>
                                <p>Desenho e validação integrados</p>
                            </div>
                        </div>
                        <div className="landing-feature">
                            <span>📄</span>
                            <div>
                                <strong>Peças Técnicas</strong>
                                <p>Memorial e planta automáticos</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
