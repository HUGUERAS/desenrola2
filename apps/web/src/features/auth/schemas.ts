import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'Senha é obrigatória'),
});

export const signUpSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    passwordConfirm: z.string().min(1, 'Confirmação de senha é obrigatória'),
    agreeTerms: z.boolean().refine((v) => v, {
        message: 'Você deve aceitar os termos de serviço',
    }),
}).superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirm) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['passwordConfirm'],
            message: 'As senhas não correspondem',
        });
    }
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
