import { useState } from 'react'
import { toast } from 'sonner'
import { signUp, registerSchema, RegisterData } from '@/lib/auth'
import { z } from 'zod'

interface Props {
    onSuccess: () => void
    onToggleMode: () => void
}

export default function Register({ onSuccess, onToggleMode }: Props) {
    const [loading, setLoading] = useState(false)
    const [erro, setErro] = useState<string | null>(null)
    const [formData, setFormData] = useState<RegisterData>({
        email: '',
        password: '',
        nome: '',
        role: 'cliente'
    })

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setErro(null)

        try {
            // Validação com Zod conforme o guia
            registerSchema.parse(formData)

            await signUp(formData)
            toast.success('Cadastro realizado! Verifique seu email se necessário.')
            onSuccess()
        } catch (error) {
            if (error instanceof z.ZodError) {
                setErro(error.errors[0].message)
            } else if (error instanceof Error) {
                setErro(error.message)
            } else {
                setErro('Erro ao realizar cadastro')
            }
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md border border-gray-100">
            <h2 className="text-2xl font-bold text-blue-800 mb-6 text-center">Criar Conta</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                    <input
                        type="text"
                        className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.nome}
                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        type="email"
                        className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                    <input
                        type="password"
                        className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Eu sou um...</label>
                    <select
                        className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                    >
                        <option value="cliente">Cliente (Quero regularizar meu terreno)</option>
                        <option value="topografo">Topógrafo (Sou profissional)</option>
                    </select>
                </div>

                {erro && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                        {erro}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Carregando...' : 'Cadastrar'}
                </button>
            </form>

            <div className="mt-6 text-center">
                <button
                    onClick={onToggleMode}
                    className="text-sm text-blue-600 hover:underline"
                >
                    Já tem conta? Entre aqui
                </button>
            </div>
        </div>
    )
}
