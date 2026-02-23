/**
 * Desenrola API Client — Supabase Direct Edition
 *
 * Mantém a mesma interface pública da versão FastAPI para que os
 * componentes não precisem mudar. Todas as chamadas vão direto ao
 * Supabase JS SDK sem passar pelo backend Python.
 */
import {
    DespesasSchema,
    LotesSchema,
    OrcamentosSchema,
    PagamentosSchema,
    ProjectsSchema,
} from './schemas';
import type { ZodType } from 'zod';
import { supabase } from '../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

type ApiResponse<T = unknown> = { data?: T; error?: string };
type ZodSchema<T> = ZodType<T>;

function ok<T>(data: T): ApiResponse<T> { return { data }; }
function err(msg: string): ApiResponse<never> { return { error: msg }; }
function supaErr(error: { message?: string } | null, fallback = 'Erro desconhecido') {
    return error?.message ?? fallback;
}

const validateResponse = <T>(schema: ZodSchema<T>, response: ApiResponse<unknown>, context: string): ApiResponse<T> => {
    if (response.error) return { error: response.error };
    const parsed = schema.safeParse(response.data);
    if (!parsed.success) { console.error(`[API] Validation failed (${context}):`, parsed.error); return { error: 'Resposta inválida do servidor' }; }
    return { data: parsed.data };
};

// ── ApiClient ─────────────────────────────────────────────────────────────────

class ApiClient {
    setToken(_token: string) { }
    clearToken() { }
    async logout() { await supabase.auth.signOut(); }

    async getPerfilMe(): Promise<ApiResponse<{ user_id: string; email?: string; role: string; crea?: string; empresa?: string; tenant_id?: string }>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return err('Não autenticado');
            const { data, error } = await supabase.from('perfis').select('*').eq('user_id', user.id).maybeSingle();
            if (error) return err(supaErr(error));
            if (!data) return ok({ user_id: user.id, email: user.email ?? '', role: 'proprietario' });
            return ok({ ...data, email: user.email ?? '' });
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao buscar perfil'); }
    }

    async setPerfilRole(role: 'topografo' | 'proprietario', extra?: { crea?: string; empresa?: string }): Promise<ApiResponse<{ ok: boolean; role: string }>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return err('Não autenticado');
            const payload: Record<string, unknown> = { user_id: user.id, role };
            if (role === 'topografo' && extra?.crea) { payload.crea = extra.crea; payload.empresa = extra.empresa ?? ''; }
            const { error } = await supabase.from('perfis').upsert(payload, { onConflict: 'user_id' });
            if (error) return err(supaErr(error));
            return ok({ ok: true, role });
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao definir role'); }
    }

    async getProjects() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const perfil = user ? await this._getPerfil(user.id) : null;
            let query = supabase.from('projetos').select('*');
            if (perfil?.tenant_id) query = query.eq('tenant_id', perfil.tenant_id as string);
            const { data, error } = await query;
            if (error) return err(supaErr(error));
            return validateResponse(ProjectsSchema, ok(data ?? []), 'getProjects');
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao listar projetos'); }
    }

    async createProject(data: { nome: string; descricao?: string; tipo?: string; endereco?: string; cidade?: string; estado?: string; observacoes?: string }) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const perfil = user ? await this._getPerfil(user.id) : null;
            const { data: created, error } = await supabase.from('projetos')
                .insert({ ...data, tipo: data.tipo ?? 'INDIVIDUAL', tenant_id: perfil?.tenant_id ?? null })
                .select().single();
            if (error) return err(supaErr(error));
            return ok(created);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao criar projeto'); }
    }

    async updateProject(id: number, data: { nome?: string; descricao?: string; tipo?: string; status?: string; endereco?: string; cidade?: string; estado?: string; observacoes?: string }) {
        try {
            const { data: updated, error } = await supabase.from('projetos').update(data).eq('id', id).select().single();
            if (error) return err(supaErr(error));
            return ok(updated);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao atualizar projeto'); }
    }

    async deleteProject(id: number) {
        try {
            const { error } = await supabase.from('projetos').delete().eq('id', id);
            if (error) return err(supaErr(error));
            return ok({ ok: true });
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao excluir projeto'); }
    }

    async getLotes(projetoId: number) {
        try {
            const { data, error } = await supabase.from('lotes').select('*').eq('projeto_id', projetoId);
            if (error) return err(supaErr(error));
            return validateResponse(LotesSchema, ok(data ?? []), 'getLotes');
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao listar lotes'); }
    }

    async getLote(id: number) {
        try {
            const { data, error } = await supabase.from('lotes').select('*').eq('id', id).single();
            if (error) return err(supaErr(error));
            return ok(data);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao buscar lote'); }
    }

    async getLotePorToken(token: string) {
        try {
            const { data, error } = await supabase.from('lotes').select('*').eq('token_acesso', token).maybeSingle();
            if (error) return err(supaErr(error));
            if (!data) return err('Link inválido ou expirado');
            return ok(data);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao buscar lote por token'); }
    }

    async salvarAcessoLote(token: string, data: { nome_cliente?: string; cpf_cnpj_cliente?: string; telefone_cliente?: string; email_cliente?: string; rg_cliente?: string; estado_civil_cliente?: string; municipio?: string; uf?: string; comarca?: string; codigo_sigef?: string; denominacao_imovel?: string; matricula_imovel?: string; geojson?: Record<string, unknown>; vizinhos?: Array<{ segmento_index: number; confrontante_tipo: string; nome: string; cpf: string; imovel: string; matricula: string }> }): Promise<ApiResponse<{ ok: boolean; lote_id: number }>> {
        try {
            const { data: lote, error: loteErr } = await supabase.from('lotes').select('id').eq('token_acesso', token).single();
            if (loteErr || !lote) return err('Link inválido ou expirado');
            const { vizinhos, ...loteData } = data;
            const updatePayload: Record<string, unknown> = { ...loteData, status: data.geojson ? 'VALIDACAO' : 'DESENHO' };
            if (data.geojson) updatePayload.geojson = data.geojson;
            await supabase.from('lotes').update(updatePayload).eq('id', lote.id);
            if (vizinhos?.length) {
                await supabase.from('confrontacoes').delete().eq('lote_id', lote.id).not('segmento_index', 'is', null);
                await supabase.from('confrontacoes').insert(vizinhos.map(v => ({ lote_id: lote.id, segmento_index: v.segmento_index, confrontante_tipo: v.confrontante_tipo, nome: v.nome, cpf: v.cpf, imovel: v.imovel, direcao: 'segmento' })));
            }
            return ok({ ok: true, lote_id: lote.id });
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao salvar'); }
    }

    async getMyLotes() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return err('Não autenticado');
            const { data, error } = await supabase.from('lotes').select('*').eq('email_cliente', user.email ?? '');
            if (error) return err(supaErr(error));
            return ok(data ?? []);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao buscar meus lotes'); }
    }

    async autoCreateLote(geojson: Record<string, unknown>) {
        try {
            const projectsRes = await this.getProjects();
            type Proj = { id: number; nome: string };
            let project = (projectsRes.data as Proj[] | undefined)?.find(p => p.nome === 'Meu Primeiro Projeto');
            if (!project) {
                const r = await this.createProject({ nome: 'Meu Primeiro Projeto', descricao: 'Criado automaticamente', tipo: 'INDIVIDUAL' });
                if (r.error) return r;
                project = r.data as Proj;
            }
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return err('Não autenticado');
            return this.createLote({ projeto_id: project.id, nome_cliente: user.user_metadata?.display_name || user.email || 'Meu Lote', email_cliente: user.email, geojson });
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao criar lote automático'); }
    }

    async createLote(data: { projeto_id: number; nome_cliente: string; email_cliente?: string; telefone_cliente?: string; cpf_cnpj_cliente?: string; geojson?: Record<string, unknown> }) {
        try {
            const { data: created, error } = await supabase.from('lotes')
                .insert({ ...data, token_acesso: crypto.randomUUID(), status: 'PENDENTE' })
                .select().single();
            if (error) return err(supaErr(error));
            return ok(created);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao criar lote'); }
    }

    async updateLoteGeometria(loteId: number, geojson: Record<string, unknown>) {
        try {
            const { data, error } = await supabase.from('lotes').update({ geojson, status: 'DESENHO' }).eq('id', loteId).select().single();
            if (error) return err(supaErr(error));
            return ok(data);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao atualizar geometria'); }
    }

    async updateLoteStatus(loteId: number, status: string) {
        try {
            const { data, error } = await supabase.from('lotes').update({ status }).eq('id', loteId).select().single();
            if (error) return err(supaErr(error));
            return ok(data);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao atualizar status'); }
    }

    async identificarVizinhos(loteId: number) {
        try {
            const { data } = await supabase.rpc('buscar_vizinhos_adjacentes', { lote_id_param: loteId });
            return ok({ success: true, vizinhos: data ?? [], vizinhos_por_direcao: {}, total_vizinhos: (data ?? []).length });
        } catch { return ok({ success: false, vizinhos: [], vizinhos_por_direcao: {}, total_vizinhos: 0 }); }
    }

    async salvarConfrontacoes(loteId: number, vizinhos: Array<{ lote_id: string; numero: number; direcao: string }>) {
        try {
            await supabase.from('confrontacoes').delete().eq('lote_id', loteId);
            if (vizinhos.length) {
                const registros = vizinhos.map(v => ({ lote_id: loteId, direcao: v.direcao, numero: v.numero, vizinho_lote_id: v.lote_id && !v.lote_id.startsWith('manual') && !isNaN(Number(v.lote_id)) ? Number(v.lote_id) : null }));
                const { error } = await supabase.from('confrontacoes').insert(registros);
                if (error) return err(supaErr(error));
            }
            return ok({ ok: true, total: vizinhos.length });
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao salvar confrontações'); }
    }

    async getConfrontacoes(loteId: number) {
        try {
            const { data, error } = await supabase.from('confrontacoes').select('*').eq('lote_id', loteId);
            if (error) return err(supaErr(error));
            return ok({ confrontacoes: data ?? [] });
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao buscar confrontações'); }
    }

    async validarTopologia(loteId: number, _geojson?: Record<string, unknown>) {
        try {
            const { data } = await supabase.rpc('validar_topologia_lote', { lote_id_param: loteId });
            return ok({ resultado: data ?? {}, valido: true });
        } catch { return ok({ resultado: {}, valido: false }); }
    }

    async getSobreposicoesLote(loteId: number) {
        try {
            const { data } = await supabase.rpc('verificar_sobreposicoes', { lote_id_param: loteId });
            return ok(data ?? []);
        } catch { return ok([]); }
    }

    async addVizinho(loteId: number, nome_vizinho: string, lado: string) {
        try {
            const { data, error } = await supabase.from('confrontacoes').insert({ lote_id: loteId, nome: nome_vizinho, direcao: lado }).select().single();
            if (error) return err(supaErr(error));
            return ok(data);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao adicionar vizinho'); }
    }

    async getVizinhos(loteId: number) {
        try {
            const { data, error } = await supabase.from('confrontacoes').select('*').eq('lote_id', loteId);
            if (error) return err(supaErr(error));
            return ok(data ?? []);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao buscar vizinhos'); }
    }

    async getOrcamentos(projetoId?: number, loteId?: number) {
        try {
            let query = supabase.from('orcamentos').select('*');
            if (projetoId) query = query.eq('projeto_id', projetoId);
            if (loteId) query = query.eq('lote_id', loteId);
            const { data, error } = await query;
            if (error) return err(supaErr(error));
            return validateResponse(OrcamentosSchema, ok(data ?? []), 'getOrcamentos');
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao listar orçamentos'); }
    }

    async createOrcamento(data: { projeto_id?: number; lote_id?: number; valor: number; status?: string; observacoes?: string; data_emissao?: string; data_vencimento?: string; cliente_nome?: string }) {
        try {
            const { data: created, error } = await supabase.from('orcamentos').insert({ ...data, status: data.status ?? 'RASCUNHO' }).select().single();
            if (error) return err(supaErr(error));
            return ok(created);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao criar orçamento'); }
    }

    async updateOrcamento(id: number, data: { valor?: number; status?: string; observacoes?: string }) {
        try {
            const { data: updated, error } = await supabase.from('orcamentos').update(data).eq('id', id).select().single();
            if (error) return err(supaErr(error));
            return ok(updated);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao atualizar orçamento'); }
    }

    async deleteOrcamento(id: number) {
        try {
            const { error } = await supabase.from('orcamentos').delete().eq('id', id);
            if (error) return err(supaErr(error));
            return ok({ ok: true });
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao excluir orçamento'); }
    }

    async getDespesas(projetoId?: number) {
        try {
            let query = supabase.from('despesas').select('*');
            if (projetoId) query = query.eq('projeto_id', projetoId);
            const { data, error } = await query;
            if (error) return err(supaErr(error));
            return validateResponse(DespesasSchema, ok(data ?? []), 'getDespesas');
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao listar despesas'); }
    }

    async createDespesa(data: { projeto_id: number; descricao: string; valor: number; data?: string; data_vencimento?: string; categoria?: string; observacoes?: string }) {
        try {
            const { data: created, error } = await supabase.from('despesas').insert(data).select().single();
            if (error) return err(supaErr(error));
            return ok(created);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao criar despesa'); }
    }

    async updateDespesa(id: number, data: { descricao?: string; valor?: number; data?: string; data_vencimento?: string; categoria?: string; observacoes?: string; projeto_id?: number }) {
        try {
            const { data: updated, error } = await supabase.from('despesas').update(data).eq('id', id).select().single();
            if (error) return err(supaErr(error));
            return ok(updated);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao atualizar despesa'); }
    }

    async deleteDespesa(id: number) {
        try {
            const { error } = await supabase.from('despesas').delete().eq('id', id);
            if (error) return err(supaErr(error));
            return ok({ ok: true });
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao excluir despesa'); }
    }

    async getPagamentos(projetoId?: number, loteId?: number) {
        try {
            let query = supabase.from('pagamentos').select('*');
            if (projetoId) query = query.eq('projeto_id', projetoId);
            if (loteId) query = query.eq('lote_id', loteId);
            const { data, error } = await query;
            if (error) return err(supaErr(error));
            return validateResponse(PagamentosSchema, ok(data ?? []), 'getPagamentos');
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao listar pagamentos'); }
    }

    async createPagamento(data: { lote_id: number; valor_total: number; valor_pago?: number; status?: string; data_pagamento?: string; data_vencimento?: string; metodo_pagamento?: string; observacoes?: string }) {
        try {
            const { data: created, error } = await supabase.from('pagamentos').insert(data).select().single();
            if (error) return err(supaErr(error));
            return ok(created);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao criar pagamento'); }
    }

    async updatePagamento(id: number, data: { valor_total?: number; valor_pago?: number; status?: string; data_pagamento?: string; metodo_pagamento?: string; observacoes?: string }) {
        try {
            const { data: updated, error } = await supabase.from('pagamentos').update(data).eq('id', id).select().single();
            if (error) return err(supaErr(error));
            return ok(updated);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao atualizar pagamento'); }
    }

    async deletePagamento(id: number) {
        try {
            const { error } = await supabase.from('pagamentos').delete().eq('id', id);
            if (error) return err(supaErr(error));
            return ok({ ok: true });
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao excluir pagamento'); }
    }

    async getDocumentos(loteId: number): Promise<ApiResponse<Array<{ id: number | string; lote_id?: number | string; tipo: string; formato?: string; arquivo_url: string; conteudo?: string; nome_arquivo?: string; created_at: string }>>> {
        try {
            const { data, error } = await supabase.from('documentos').select('*').eq('lote_id', loteId).order('created_at', { ascending: false });
            if (error) return err(supaErr(error));
            return ok(data ?? []);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao buscar documentos'); }
    }

    async gerarDocumento(loteId: number, tipo: string = 'memorial') {
        try {
            const { data, error } = await supabase.rpc('gerar_documento', { lote_id_param: loteId, tipo_param: tipo });
            if (!error && data) return ok(data);
            const { data: doc, error: insErr } = await supabase.from('documentos').insert({ lote_id: loteId, tipo, formato: 'txt', arquivo_url: '' }).select().single();
            if (insErr) return err(supaErr(insErr));
            return ok(doc);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao gerar documento'); }
    }

    async uploadDocumento(loteId: number, tipo: string, arquivo: File) {
        try {
            const ext = arquivo.name.split('.').pop() ?? 'bin';
            const path = `lotes/${loteId}/${tipo}-${Date.now()}.${ext}`;
            const { error: uploadErr } = await supabase.storage.from('documentos').upload(path, arquivo);
            if (uploadErr) return err(supaErr(uploadErr));
            const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);
            const { data: doc, error: insErr } = await supabase.from('documentos').insert({ lote_id: loteId, tipo, arquivo_url: publicUrl, nome_arquivo: arquivo.name, formato: ext }).select().single();
            if (insErr) return err(supaErr(insErr));
            return ok(doc);
        } catch (e: unknown) { return err(e instanceof Error ? e.message : 'Erro ao fazer upload'); }
    }

    private async _getPerfil(userId: string): Promise<Record<string, unknown> | null> {
        const { data } = await supabase.from('perfis').select('*').eq('user_id', userId).maybeSingle();
        return data ?? null;
    }
}

export const apiClient = new ApiClient();
export default apiClient;
