/**
 * Landing — Página inicial com sidebar de auth + fundo estilo mapa
 * Layout: sidebar esquerda (login/signup) + fundo direito (features)
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Map, MapPin, FileText, Compass } from 'lucide-react';
import { supabase } from '../lib/supabase';
import apiClient from '../services/api';

type Tab = 'entrar' | 'cadastro';

// ─── Login Form ───────────────────────────────────────────────────────────────
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErro('');
        setCarregando(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                throw new Error(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message);
            }
            const token = data.session?.access_token;
            if (!token) throw new Error('Sessão inválida: Token não recebido');
            apiClient.setToken(token);
            try {
                const perfilResponse = await apiClient.getPerfilMe();
                if (perfilResponse.error || !perfilResponse.data) {
                    const setRoleResponse = await apiClient.setPerfilRole('proprietario');
                    if (setRoleResponse.error) {
                        throw new Error(`Erro ao sincronizar perfil: ${setRoleResponse.error}`);
                    }
                }
            } catch {
                throw new Error('Login realizado, mas erro ao conectar com servidor de dados. Tente novamente.');
            }
            onSuccess();
        } catch (err: unknown) {
            setErro(err instanceof Error ? err.message : 'Erro desconhecido ao entrar');
        } finally {
            setCarregando(false);
        }
    };

    return (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {erro && (
                <div style={styles.errorBox}>{erro}</div>
            )}
            <div>
                <label style={styles.label}>Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    style={styles.input}
                    placeholder="seu@email.com"
                />
            </div>
            <div>
                <label style={styles.label}>Senha</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    style={styles.input}
                    placeholder="••••••••"
                />
            </div>
            <button type="submit" disabled={carregando} style={carregando ? styles.btnDisabled : styles.btnPrimary}>
                {carregando ? '⏳ Entrando...' : 'Entrar'}
            </button>
        </form>
    );
}

// ─── Signup Form ──────────────────────────────────────────────────────────────
function SignupForm({ onSuccess }: { onSuccess: () => void }) {
    const [formData, setFormData] = useState({ name: '', email: '', password: '', passwordConfirm: '', agreeTerms: false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!formData.name.trim()) { setError('Nome é obrigatório'); return; }
        if (formData.password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres'); return; }
        if (formData.password !== formData.passwordConfirm) { setError('As senhas não correspondem'); return; }
        if (!formData.agreeTerms) { setError('Você deve aceitar os termos de serviço'); return; }

        setLoading(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            });
            if (authError) {
                if (authError.message.includes('confirm')) {
                    setSuccess('✉️ Conta criada! Verifique seu email para confirmar.');
                    return;
                }
                throw authError;
            }
            if (!authData.user) throw new Error('Erro ao criar usuário');
            const token = authData.session?.access_token;
            if (token) {
                apiClient.setToken(token);
                await apiClient.setPerfilRole('proprietario');
                try {
                    await supabase.auth.updateUser({ data: { display_name: formData.name } });
                } catch {
                    // ignora erro de nome
                }
                onSuccess();
            } else {
                setSuccess('✉️ Conta criada! Verifique seu email para confirmar e faça login.');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro ao criar conta';
            if (msg.includes('already registered')) {
                setError('📧 Este email já está registrado.');
            } else if (msg.includes('weak')) {
                setError('🔒 Senha muito fraca.');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}
            <div>
                <label style={styles.label}>Nome Completo</label>
                <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={styles.input}
                    placeholder="João da Silva"
                />
            </div>
            <div>
                <label style={styles.label}>Email</label>
                <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    style={styles.input}
                    placeholder="seu@email.com"
                />
            </div>
            <div>
                <label style={styles.label}>Senha</label>
                <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    style={styles.input}
                    placeholder="mínimo 6 caracteres"
                />
            </div>
            <div>
                <label style={styles.label}>Confirmar Senha</label>
                <input
                    type="password"
                    value={formData.passwordConfirm}
                    onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                    required
                    style={styles.input}
                    placeholder="••••••••"
                />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <input
                    type="checkbox"
                    id="terms"
                    checked={formData.agreeTerms}
                    onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                    style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                />
                <label htmlFor="terms" style={{ fontSize: '0.8rem', color: '#9ca3af', cursor: 'pointer', lineHeight: '1.4' }}>
                    Concordo com os termos de serviço e política de privacidade
                </label>
            </div>
            <button
                type="submit"
                disabled={loading || !formData.agreeTerms}
                style={(loading || !formData.agreeTerms) ? styles.btnDisabled : styles.btnPrimary}
            >
                {loading ? '⏳ Criando conta...' : 'Criar Conta Grátis'}
            </button>
        </form>
    );
}

// ─── Main Landing ─────────────────────────────────────────────────────────────
export default function Landing() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const defaultTab: Tab = searchParams.get('tab') === 'cadastro' ? 'cadastro' : 'entrar';
    const [tab, setTab] = useState<Tab>(defaultTab);

    return (
        <div style={styles.root}>
            {/* ── Sidebar ───────────────────────────────────────── */}
            <div style={styles.sidebar}>
                {/* Logo */}
                <div style={styles.logoArea}>
                    <div style={styles.logoIcon}>
                        <Map size={28} color="#10b981" />
                    </div>
                    <div>
                        <div style={styles.logoTitle}>Desenrola</div>
                        <div style={styles.logoSub}>Regularização fundiária digital</div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                    <button
                        style={tab === 'entrar' ? styles.tabActive : styles.tabInactive}
                        onClick={() => setTab('entrar')}
                    >
                        Entrar
                    </button>
                    <button
                        style={tab === 'cadastro' ? styles.tabActive : styles.tabInactive}
                        onClick={() => setTab('cadastro')}
                    >
                        Criar Conta
                    </button>
                </div>

                {/* Form area */}
                <div style={styles.formArea}>
                    {tab === 'entrar' ? (
                        <>
                            <LoginForm onSuccess={() => navigate('/app')} />
                            <p style={styles.switchText}>
                                Não tem conta?{' '}
                                <button style={styles.switchLink} onClick={() => setTab('cadastro')}>
                                    Criar Conta
                                </button>
                            </p>
                        </>
                    ) : (
                        <>
                            <SignupForm onSuccess={() => navigate('/app')} />
                            <p style={styles.switchText}>
                                Já tem conta?{' '}
                                <button style={styles.switchLink} onClick={() => setTab('entrar')}>
                                    Fazer login
                                </button>
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* ── Right panel ───────────────────────────────────── */}
            <div style={styles.mapPanel}>
                <div style={styles.mapOverlay}>
                    <h2 style={styles.mapTitle}>Regularização fundiária<br />simplificada</h2>
                    <p style={styles.mapSub}>Ferramentas profissionais para topógrafos e proprietários</p>
                    <div style={styles.features}>
                        <FeatureCard icon={<MapPin size={20} color="#10b981" />} title="SIRGAS 2000" desc="Padrão oficial brasileiro para coordenadas geográficas" />
                        <FeatureCard icon={<Compass size={20} color="#3b82f6" />} title="Ferramentas CAD" desc="21 ferramentas de medição, edição e topologia integradas" />
                        <FeatureCard icon={<FileText size={20} color="#8b5cf6" />} title="Peças Técnicas" desc="Memorial descritivo e planta gerados automaticamente" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
    return (
        <div style={styles.featureCard}>
            <div style={styles.featureIcon}>{icon}</div>
            <div>
                <div style={styles.featureTitle}>{title}</div>
                <div style={styles.featureDesc}>{desc}</div>
            </div>
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
    root: {
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
    },
    // Sidebar
    sidebar: {
        width: '380px',
        minWidth: '340px',
        background: '#0f1117',
        borderRight: '1px solid #1e2530',
        display: 'flex',
        flexDirection: 'column',
        padding: '2rem 1.75rem',
        overflowY: 'auto',
    },
    logoArea: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '2rem',
    },
    logoIcon: {
        width: '44px',
        height: '44px',
        background: 'rgba(16, 185, 129, 0.12)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    logoTitle: {
        fontSize: '1.25rem',
        fontWeight: 700,
        color: '#f9fafb',
        letterSpacing: '-0.01em',
    },
    logoSub: {
        fontSize: '0.75rem',
        color: '#6b7280',
        marginTop: '1px',
    },
    // Tabs
    tabs: {
        display: 'flex',
        background: '#1a2030',
        borderRadius: '8px',
        padding: '3px',
        marginBottom: '1.75rem',
    },
    tabActive: {
        flex: 1,
        padding: '0.5rem',
        background: '#10b981',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontWeight: 600,
        fontSize: '0.875rem',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    tabInactive: {
        flex: 1,
        padding: '0.5rem',
        background: 'transparent',
        color: '#9ca3af',
        border: 'none',
        borderRadius: '6px',
        fontWeight: 500,
        fontSize: '0.875rem',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    // Form
    formArea: {
        flex: 1,
    },
    label: {
        display: 'block',
        marginBottom: '0.4rem',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#d1d5db',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    input: {
        width: '100%',
        padding: '0.65rem 0.75rem',
        background: '#1a2030',
        border: '1px solid #2d3748',
        borderRadius: '7px',
        fontSize: '0.9rem',
        color: '#f3f4f6',
        outline: 'none',
        boxSizing: 'border-box' as const,
    },
    btnPrimary: {
        width: '100%',
        padding: '0.75rem',
        background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '0.95rem',
        fontWeight: 700,
        cursor: 'pointer',
        marginTop: '0.25rem',
        transition: 'opacity 0.15s ease',
    },
    btnDisabled: {
        width: '100%',
        padding: '0.75rem',
        background: '#374151',
        color: '#9ca3af',
        border: 'none',
        borderRadius: '8px',
        fontSize: '0.95rem',
        fontWeight: 700,
        cursor: 'not-allowed',
        marginTop: '0.25rem',
    },
    errorBox: {
        padding: '0.65rem 0.75rem',
        background: 'rgba(239,68,68,0.12)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '7px',
        fontSize: '0.85rem',
        color: '#f87171',
    },
    successBox: {
        padding: '0.65rem 0.75rem',
        background: 'rgba(16,185,129,0.12)',
        border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: '7px',
        fontSize: '0.85rem',
        color: '#34d399',
    },
    switchText: {
        marginTop: '1.25rem',
        textAlign: 'center' as const,
        fontSize: '0.85rem',
        color: '#6b7280',
    },
    switchLink: {
        background: 'none',
        border: 'none',
        color: '#10b981',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: '0.85rem',
        padding: 0,
        textDecoration: 'underline',
    },
    // Right panel
    mapPanel: {
        flex: 1,
        background: 'linear-gradient(160deg, #0a1628 0%, #0d1f3c 40%, #0b1a2e 70%, #071220 100%)',
        position: 'relative' as const,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    mapOverlay: {
        maxWidth: '520px',
        padding: '2rem',
        zIndex: 1,
    },
    mapTitle: {
        fontSize: '2.25rem',
        fontWeight: 800,
        color: '#f9fafb',
        lineHeight: 1.2,
        marginBottom: '0.75rem',
        letterSpacing: '-0.02em',
    },
    mapSub: {
        fontSize: '1rem',
        color: '#9ca3af',
        marginBottom: '2.5rem',
        lineHeight: 1.6,
    },
    features: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1rem',
    },
    featureCard: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.875rem',
        padding: '1rem 1.25rem',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        backdropFilter: 'blur(4px)',
    },
    featureIcon: {
        width: '36px',
        height: '36px',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: '2px',
    },
    featureTitle: {
        fontSize: '0.95rem',
        fontWeight: 700,
        color: '#f3f4f6',
        marginBottom: '0.2rem',
    },
    featureDesc: {
        fontSize: '0.82rem',
        color: '#6b7280',
        lineHeight: 1.5,
    },
};
