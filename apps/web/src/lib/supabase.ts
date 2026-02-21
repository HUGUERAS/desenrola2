/**
 * Supabase client — inicializa com variaveis de ambiente Vite
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
    throw new Error(
        `[Supabase] Variáveis ausentes: ${missing.join(', ')}. Configure apps/web/.env para iniciar o frontend.`
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
