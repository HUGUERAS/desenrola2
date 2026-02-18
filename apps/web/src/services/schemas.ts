import { z } from 'zod';

const zId = z
    .union([z.number(), z.string()])
    .transform((value: number | string) => Number(value));

export const ProjectSchema = z
    .object({
        id: zId,
        nome: z.string(),
    })
    .passthrough();

export const LoteSchema = z
    .object({
        id: zId,
        nome_cliente: z.string(),
        projeto_id: zId,
    })
    .passthrough();

export const DespesaSchema = z
    .object({
        id: zId,
        projeto_id: zId,
        descricao: z.string(),
        valor: z.number(),
        data: z.string(),
        categoria: z.string().optional(),
        observacoes: z.string().optional(),
        criado_em: z.string().optional(),
    })
    .passthrough();

export const PagamentoSchema = z
    .object({
        id: zId,
        lote_id: zId,
        valor_total: z.number(),
        valor_pago: z.number(),
        status: z.string(),
        data_pagamento: z.string().optional(),
        metodo_pagamento: z.string().optional(),
    })
    .passthrough();

export const OrcamentoSchema = z
    .object({
        id: zId,
        projeto_id: zId.optional(),
        lote_id: zId.optional(),
        valor: z.number(),
        status: z.string(),
        observacoes: z.string().optional(),
        criado_em: z.string().optional(),
        atualizado_em: z.string().optional(),
    })
    .passthrough();

export const ProjectsSchema = z.array(ProjectSchema);
export const LotesSchema = z.array(LoteSchema);
export const DespesasSchema = z.array(DespesaSchema);
export const PagamentosSchema = z.array(PagamentoSchema);
export const OrcamentosSchema = z.array(OrcamentoSchema);
