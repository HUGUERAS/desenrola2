import { useState } from 'react';
import { loginSchema } from '../schemas';
import { loginWithProfileSync } from '../service';
import { AuthField } from './AuthField';
import { AuthMessage } from './AuthMessage';
import { AuthSubmitButton } from './AuthSubmitButton';

type LoginFormProps = {
    onSuccess: () => void;
};

export function LoginForm({ onSuccess }: LoginFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
            return;
        }

        setLoading(true);
        const result = await loginWithProfileSync(parsed.data);
        setLoading(false);

        if (!result.ok) {
            setError(result.error ?? 'Erro ao entrar');
            return;
        }
        onSuccess();
    };

    return (
        <form onSubmit={handleSubmit} className="auth-form">
            <AuthMessage type="error" message={error} />
            <AuthField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="seu@email.com"
                required
            />
            <AuthField
                label="Senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
            />
            <AuthSubmitButton loading={loading} loadingLabel="Entrando..." idleLabel="Entrar" type="submit" />
        </form>
    );
}
