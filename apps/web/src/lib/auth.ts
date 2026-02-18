import { supabase } from './supabase'
import { z } from 'zod'

export const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres')
})

export const registerSchema = loginSchema.extend({
    nome: z.string().min(3, 'Nome muito curto'),
    role: z.enum(['cliente', 'topografo'])
})

export type LoginData = z.infer<typeof loginSchema>
export type RegisterData = z.infer<typeof registerSchema>

export async function signIn({ email, password }: LoginData) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })
    if (error) throw error
    return data
}

export async function signUp({ email, password, nome, role }: RegisterData) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                nome,
                role
            }
        }
    })
    if (error) throw error
    return data
}

export async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
}
