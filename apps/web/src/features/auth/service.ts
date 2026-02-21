import { supabase } from '../../lib/supabase';
import apiClient from '../../services/api';
import type { LoginInput, SignUpInput } from './schemas';

const INVALID_LOGIN_MSG = 'Email ou senha incorretos';
const BACKEND_SYNC_MSG = 'Login realizado, mas erro ao conectar com servidor de dados. Tente novamente.';

export type AuthResult = {
    ok: boolean;
    error?: string;
};

export type SignUpResult = AuthResult & {
    requiresEmailConfirmation?: boolean;
};

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function mapSignUpError(message: string): string {
    if (message.includes('already registered')) return 'Este email já está registrado.';
    if (message.includes('weak')) return 'Senha muito fraca.';
    return message;
}

export async function loginWithProfileSync(input: LoginInput): Promise<AuthResult> {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizeEmail(input.email),
            password: input.password,
        });

        if (error) {
            return { ok: false, error: error.message === 'Invalid login credentials' ? INVALID_LOGIN_MSG : error.message };
        }

        const token = data.session?.access_token;
        if (!token) return { ok: false, error: 'Sessão inválida: token não recebido' };

        apiClient.setToken(token);
        const perfilResponse = await apiClient.getPerfilMe();
        if (perfilResponse.error || !perfilResponse.data) {
            const setRoleResponse = await apiClient.setPerfilRole('proprietario');
            if (setRoleResponse.error) {
                return { ok: false, error: `Erro ao sincronizar perfil: ${setRoleResponse.error}` };
            }
        }

        return { ok: true };
    } catch {
        return { ok: false, error: BACKEND_SYNC_MSG };
    }
}

export async function signUpWithProfile(input: SignUpInput): Promise<SignUpResult> {
    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: normalizeEmail(input.email),
            password: input.password,
        });

        if (authError) return { ok: false, error: mapSignUpError(authError.message) };
        if (!authData.user) return { ok: false, error: 'Erro ao criar usuário' };

        const token = authData.session?.access_token;
        if (!token) {
            return {
                ok: true,
                requiresEmailConfirmation: true,
            };
        }

        apiClient.setToken(token);
        const roleRes = await apiClient.setPerfilRole('proprietario');
        if (roleRes.error) {
            console.warn('Falha ao sincronizar perfil no cadastro:', roleRes.error);
        }

        try {
            await supabase.auth.updateUser({ data: { display_name: input.name } });
        } catch (err) {
            console.warn('Aviso ao atualizar nome:', err);
        }

        return { ok: true };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao criar conta';
        return { ok: false, error: mapSignUpError(msg) };
    }
}
