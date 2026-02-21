import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';

export default function LoginPage() {
    const navigate = useNavigate();

    return (
        <div className="auth-single-page auth-single-login">
            <div className="auth-single-card">
                <h2 className="auth-single-title">Entrar</h2>
                <p className="auth-single-subtitle">Acesse sua área de regularização</p>
                <LoginForm onSuccess={() => navigate('/app')} />
                <p className="auth-switch">
                    Não tem conta?{' '}
                    <button className="auth-switch-link" onClick={() => navigate('/signup')} type="button">
                        Criar Conta
                    </button>
                </p>
            </div>
        </div>
    );
}
