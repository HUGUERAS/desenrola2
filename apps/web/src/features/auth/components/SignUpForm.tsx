import { useState } from 'react';
import { signUpSchema } from '../schemas';
import { signUpWithProfile } from '../service';
import { AuthField } from './AuthField';
import { AuthMessage } from './AuthMessage';
import { AuthSubmitButton } from './AuthSubmitButton';

type SignUpFormProps = {
    onSuccess: () => void;
    onEmailConfirmationNeeded?: () => void;
};

export function SignUpForm({ onSuccess, onEmailConfirmationNeeded }: SignUpFormProps) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        passwordConfirm: '',
        agreeTerms: false,
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const setField = (field: keyof typeof formData, value: string | boolean) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const parsed = signUpSchema.safeParse(formData);
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
            return;
        }

        setLoading(true);
        const result = await signUpWithProfile(parsed.data);
        setLoading(false);

        if (!result.ok) {
            setError(result.error ?? 'Erro ao criar conta');
            return;
        }

        if (result.requiresEmailConfirmation) {
            setSuccess('Conta criada! Verifique seu email para confirmar e depois faça login.');
            onEmailConfirmationNeeded?.();
            return;
        }

        onSuccess();
    };

    return (
        <form onSubmit={handleSubmit} className="auth-form auth-form-tight">
            <AuthMessage type="error" message={error} />
            <AuthMessage type="success" message={success} />

            <AuthField
                label="Nome Completo"
                type="text"
                value={formData.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="João da Silva"
                required
            />
            <AuthField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setField('email', e.target.value)}
                autoComplete="email"
                placeholder="seu@email.com"
                required
            />
            <AuthField
                label="Senha"
                type="password"
                value={formData.password}
                onChange={(e) => setField('password', e.target.value)}
                autoComplete="new-password"
                placeholder="mínimo 6 caracteres"
                required
            />
            <AuthField
                label="Confirmar Senha"
                type="password"
                value={formData.passwordConfirm}
                onChange={(e) => setField('passwordConfirm', e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                required
            />

            <div className="auth-check-row">
                <input
                    type="checkbox"
                    id="terms"
                    checked={formData.agreeTerms}
                    onChange={(e) => setField('agreeTerms', e.target.checked)}
                />
                <label htmlFor="terms" className="auth-check-label">
                    Concordo com os termos de serviço e política de privacidade
                </label>
            </div>

            <AuthSubmitButton
                loading={loading}
                loadingLabel="Criando conta..."
                idleLabel="Criar Conta Grátis"
                type="submit"
                disabled={!formData.agreeTerms}
            />
        </form>
    );
}
