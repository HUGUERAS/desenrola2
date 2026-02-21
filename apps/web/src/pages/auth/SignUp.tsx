/**
 * SignUp — Registro de novo usuário
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import apiClient from '../../services/api';

export default function SignUp() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        passwordConfirm: '',
        agreeTerms: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.name.trim()) {
            setError('Nome é obrigatório');
            return;
        }
        if (formData.password.length < 6) {
            setError('Senha deve ter pelo menos 6 caracteres');
            return;
        }
        if (formData.password !== formData.passwordConfirm) {
            setError('As senhas não correspondem');
            return;
        }
        if (!formData.agreeTerms) {
            setError('Você deve aceitar os termos de serviço');
            return;
        }

        setLoading(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email.trim().toLowerCase(),
                password: formData.password,
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('Erro ao criar usuário');

            const token = authData.session?.access_token;
            if (token) {
                apiClient.setToken(token);
                const roleRes = await apiClient.setPerfilRole('proprietario');
                if (roleRes.error) {
                    console.warn('Falha ao sincronizar perfil no cadastro:', roleRes.error);
                }
                try {
                    await supabase.auth.updateUser({
                        data: { display_name: formData.name },
                    });
                } catch (err) {
                    console.warn('Aviso ao atualizar nome:', err);
                }
                navigate('/login?registered=true');
                return;
            }

            setSuccess('✉️ Conta criada! Verifique seu email para confirmar e depois faça login.');
            setTimeout(() => navigate('/login?registered=true'), 3000);
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

    const inputStyle = {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '1rem',
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px',
        }}>
            <div style={{
                background: 'white',
                padding: '3rem',
                borderRadius: '16px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                width: '100%',
                maxWidth: '480px',
            }}>
                <h2 style={{ marginBottom: '0.5rem', textAlign: 'center', fontSize: '1.8rem', color: '#1a202c' }}>
                    ➕ Criar Conta
                </h2>
                <p style={{ marginBottom: '2rem', textAlign: 'center', color: '#718096', fontSize: '0.95rem' }}>
                    Comece a regularizar sua propriedade
                </p>

                {error && (
                    <div style={{ padding: '0.75rem', background: '#fee', color: '#c00', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div style={{ padding: '0.75rem', background: '#ecfdf5', color: '#047857', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label htmlFor="name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2d3748' }}>
                            Nome Completo
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2d3748' }}>
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2d3748' }}>
                            Senha
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="passwordConfirm" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2d3748' }}>
                            Confirmar Senha
                        </label>
                        <input
                            id="passwordConfirm"
                            type="password"
                            value={formData.passwordConfirm}
                            onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                        <input
                            type="checkbox"
                            id="terms"
                            checked={formData.agreeTerms}
                            onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                            style={{ marginTop: '0.25rem' }}
                        />
                        <label htmlFor="terms" style={{ fontSize: '0.85rem', color: '#4a5568', cursor: 'pointer' }}>
                            Concordo com os termos de serviço e política de privacidade
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !formData.agreeTerms}
                        style={{
                            padding: '1rem',
                            background: (loading || !formData.agreeTerms) ? '#a0aec0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            cursor: (loading || !formData.agreeTerms) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {loading ? '⏳ Criando conta...' : '🚀 Criar Conta Grátis'}
                    </button>
                </form>

                <p style={{ marginTop: '1.5rem', textAlign: 'center', color: '#718096', fontSize: '0.9rem' }}>
                    Já tem uma conta?{' '}
                    <a href="/login" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 'bold' }}>
                        Faça login aqui
                    </a>
                </p>
                <p style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <a href="/" style={{ color: '#667eea', textDecoration: 'none', fontSize: '0.9rem' }}>
                        ← Voltar para Home
                    </a>
                </p>
            </div>
        </div>
    );
}
