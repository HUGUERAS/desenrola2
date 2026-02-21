import { useNavigate } from 'react-router-dom';
import { SignUpForm } from '../components/SignUpForm';

export default function SignUpPage() {
    const navigate = useNavigate();

    return (
        <div className="auth-single-page auth-single-signup">
            <div className="auth-single-card">
                <h2 className="auth-single-title">Criar Conta</h2>
                <p className="auth-single-subtitle">Comece a regularizar sua propriedade</p>
                <SignUpForm
                    onSuccess={() => navigate('/login?registered=true')}
                    onEmailConfirmationNeeded={() => {
                        window.setTimeout(() => navigate('/login?registered=true'), 3000);
                    }}
                />
                <p className="auth-switch">
                    Já tem conta?{' '}
                    <button className="auth-switch-link" onClick={() => navigate('/login')} type="button">
                        Fazer login
                    </button>
                </p>
            </div>
        </div>
    );
}
