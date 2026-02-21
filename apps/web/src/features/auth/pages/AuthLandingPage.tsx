import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Compass, FileText, Map, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { LoginForm } from '../components/LoginForm';
import { SignUpForm } from '../components/SignUpForm';

type Tab = 'entrar' | 'cadastro';

function FeatureCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
    return (
        <div className="auth-feature-card">
            <div className="auth-feature-icon">{icon}</div>
            <div>
                <div className="auth-feature-title">{title}</div>
                <div className="auth-feature-desc">{desc}</div>
            </div>
        </div>
    );
}

export default function AuthLandingPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const defaultTab: Tab = searchParams.get('tab') === 'cadastro' ? 'cadastro' : 'entrar';
    const [tab, setTab] = useState<Tab>(defaultTab);

    return (
        <div className="auth-root">
            <div className="auth-sidebar">
                <div className="auth-logo-area">
                    <div className="auth-logo-icon">
                        <Map size={28} color="var(--auth-brand-1)" />
                    </div>
                    <div>
                        <div className="auth-logo-title">Desenrola</div>
                        <div className="auth-logo-sub">Regularização fundiária digital</div>
                    </div>
                </div>

                <div className="auth-tabs">
                    <button
                        className={tab === 'entrar' ? 'auth-tab active' : 'auth-tab'}
                        onClick={() => setTab('entrar')}
                        type="button"
                    >
                        Entrar
                    </button>
                    <button
                        className={tab === 'cadastro' ? 'auth-tab active' : 'auth-tab'}
                        onClick={() => setTab('cadastro')}
                        type="button"
                    >
                        Criar Conta
                    </button>
                </div>

                <div className="auth-form-wrap">
                    {tab === 'entrar' ? (
                        <>
                            <LoginForm onSuccess={() => navigate('/app')} />
                            <p className="auth-switch">
                                Não tem conta?{' '}
                                <button className="auth-switch-link" onClick={() => setTab('cadastro')} type="button">
                                    Criar Conta
                                </button>
                            </p>
                        </>
                    ) : (
                        <>
                            <SignUpForm onSuccess={() => navigate('/app')} />
                            <p className="auth-switch">
                                Já tem conta?{' '}
                                <button className="auth-switch-link" onClick={() => setTab('entrar')} type="button">
                                    Fazer login
                                </button>
                            </p>
                        </>
                    )}
                </div>
            </div>

            <div className="auth-hero">
                <div className="auth-hero-content">
                    <h2 className="auth-hero-title">Regularização fundiária simplificada</h2>
                    <p className="auth-hero-sub">Ferramentas profissionais para topógrafos e proprietários</p>
                    <div className="auth-feature-list">
                        <FeatureCard icon={<MapPin size={20} color="var(--auth-brand-1)" />} title="SIRGAS 2000" desc="Padrão oficial brasileiro para coordenadas geográficas" />
                        <FeatureCard icon={<Compass size={20} color="#60a5fa" />} title="Ferramentas CAD" desc="21 ferramentas de medição, edição e topologia integradas" />
                        <FeatureCard icon={<FileText size={20} color="#f59e0b" />} title="Peças Técnicas" desc="Memorial descritivo e planta gerados automaticamente" />
                    </div>
                </div>
            </div>
        </div>
    );
}
