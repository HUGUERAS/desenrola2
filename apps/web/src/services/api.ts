/**
 * Desenrola API Client
 * Inspirado no Ativo Real com retry, timeout, e validação Zod.
 * Endpoints alinhados ao DEVELOPMENT_GUIDE.md
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

const API_URL = import.meta.env.VITE_API_URL ?? '';
console.log('API Client (v2) initialized with URL:', API_URL);
// if (!API_URL && import.meta.env.DEV) {
//     console.error('VITE_API_URL é obrigatório. Configure em .env.');
// }

type RetryOptions = {
    retries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    retryOnStatuses?: number[];
};

type RequestOptions = RequestInit & {
    timeoutMs?: number;
    retry?: RetryOptions;
};

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRY: Required<RetryOptions> = {
    retries: 2,
    baseDelayMs: 300,
    maxDelayMs: 2000,
    retryOnStatuses: [408, 429, 500, 502, 503, 504],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isIdempotent = (method: string) => method === 'GET' || method === 'HEAD';

interface ApiResponse<T = unknown> {
    data?: T;
    error?: string;
}

type ZodSchema<T> = ZodType<T>;

const validateResponse = <T>(
    schema: ZodSchema<T>,
    response: ApiResponse<unknown>,
    context: string
): ApiResponse<T> => {
    if (response.error) return { error: response.error };
    const parsed = schema.safeParse(response.data);
    if (!parsed.success) {
        console.error(`[API] Validation failed (${context}):`, parsed.error);
        return { error: 'Resposta inválida do servidor' };
    }
    return { data: parsed.data };
};

class ApiClient {
    private baseUrl: string;
    private token: string | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = localStorage.getItem('auth_token');
    }

    setToken(token: string) {
        this.token = token;
        localStorage.setItem('auth_token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('auth_token');
    }

    logout() {
        this.clearToken();
    }

    private async request<T>(
        endpoint: string,
        options: RequestOptions = {}
    ): Promise<ApiResponse<T>> {
        const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const { timeoutMs = DEFAULT_TIMEOUT_MS, retry, ...fetchOptions } = options;
        const method = (fetchOptions.method || 'GET').toUpperCase();
        const retryConfig = { ...DEFAULT_RETRY, ...(retry ?? {}) };
        const shouldRetry = isIdempotent(method);
        let attempt = 0;

        try {
            while (true) {
                attempt += 1;
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    return { error: 'Sem conexão com a internet' };
                }

                const controller = new AbortController();
                const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

                try {
                    const response = await fetch(url, {
                        ...fetchOptions,
                        headers,
                        signal: controller.signal,
                    });
                    const text = await response.text();
                    const payload = text ? JSON.parse(text) : null;

                    if (!response.ok) {
                        if (response.status === 401) this.clearToken();
                        const errorMessage =
                            payload?.detail || payload?.message || payload?.error || 'Erro na requisição';

                        if (
                            shouldRetry &&
                            attempt <= retryConfig.retries &&
                            retryConfig.retryOnStatuses.includes(response.status)
                        ) {
                            const delay = Math.min(
                                retryConfig.baseDelayMs * 2 ** (attempt - 1),
                                retryConfig.maxDelayMs
                            );
                            await sleep(delay + Math.floor(Math.random() * 100));
                            continue;
                        }

                        return { error: errorMessage };
                    }

                    return { data: payload as T };
                } catch (error) {
                    const isTimeout =
                        error instanceof DOMException && error.name === 'AbortError';
                    const errorMessage = isTimeout
                        ? 'Tempo limite excedido'
                        : error instanceof Error
                            ? error.message
                            : 'Erro de conexão';

                    if (shouldRetry && attempt <= retryConfig.retries && !isTimeout) {
                        const delay = Math.min(
                            retryConfig.baseDelayMs * 2 ** (attempt - 1),
                            retryConfig.maxDelayMs
                        );
                        await sleep(delay + Math.floor(Math.random() * 100));
                        continue;
                    }

                    return { error: errorMessage };
                } finally {
                    window.clearTimeout(timeoutId);
                }
            }
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : 'Erro de conexão',
            };
        }
    }

    // ==================== PERFIL ====================

    async getPerfilMe() {
        return this.request<{ user_id: string; email?: string; role: string; crea?: string; empresa?: string }>(
            '/api/perfis/me'
        );
    }

    async setPerfilRole(role: 'topografo' | 'proprietario', extra?: { crea?: string; empresa?: string }) {
        return this.request('/api/perfis/set-role', {
            method: 'POST',
            body: JSON.stringify({ role, ...extra }),
        });
    }

    // ==================== PROJETOS ====================

    async getProjects() {
        const response = await this.request<unknown[]>('/api/projetos');
        return validateResponse(ProjectsSchema, response, 'getProjects');
    }

    async createProject(data: {
        nome: string;
        descricao?: string;
        tipo?: string;
        endereco?: string;
        cidade?: string;
        estado?: string;
        observacoes?: string;
    }) {
        return this.request('/api/projetos', {
            method: 'POST',
            body: JSON.stringify({ ...data, tipo: data.tipo || 'INDIVIDUAL' }),
        });
    }

    async updateProject(
        id: number,
        data: {
            nome?: string;
            descricao?: string;
            tipo?: string;
            status?: string;
            endereco?: string;
            cidade?: string;
            estado?: string;
            observacoes?: string;
        }
    ) {
        return this.request(`/api/projetos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteProject(id: number) {
        return this.request(`/api/projetos/${id}`, { method: 'DELETE' });
    }

    // ==================== LOTES ====================

    async getLotes(projetoId: number) {
        const response = await this.request<unknown[]>(
            `/api/lotes?projeto_id=${projetoId}`
        );
        return validateResponse(LotesSchema, response, 'getLotes');
    }

    async getLote(id: number) {
        return this.request<unknown>(`/api/lotes/${id}`);
    }

    async getLotePorToken(token: string) {
        return this.request<unknown>(
            `/api/acesso-lote?token=${encodeURIComponent(token)}`
        );
    }

    async getMyLotes() {
        return this.request<unknown[]>('/api/lotes');
    }

    async autoCreateLote(geojson: Record<string, any>) {
        // 1. Criar projeto padrão se necessário
        console.log('Auto-criando lote...');
        const projectsRes = await this.getProjects();
        let project = projectsRes.data?.find(p => p.nome === 'Meu Primeiro Projeto');

        if (!project) {
            console.log('Criando projeto padrão...');
            const createProjRes = await this.createProject({
                nome: 'Meu Primeiro Projeto',
                descricao: 'Projeto criado automaticamente ao desenhar',
                tipo: 'INDIVIDUAL'
            });
            if (createProjRes.error) {
                console.error('Erro ao criar projeto:', createProjRes.error);
                return createProjRes;
            }
            project = createProjRes.data as any;
        }

        // 2. Criar lote
        const userRes = await supabase.auth.getUser();
        const user = userRes.data.user;
        if (!user) {
            console.error('Usuário não autenticado no autoCreateLote');
            return { error: 'Usuário não autenticado', data: null };
        }

        const nome = user.user_metadata?.display_name || user.email || 'Meu Lote';

        console.log('Criando lote na base...');
        return this.createLote({
            projeto_id: (project as any).id,
            nome_cliente: nome,
            email_cliente: user.email,
            geojson: geojson
        });
    }

    async createLote(data: {
        projeto_id: number;
        nome_cliente: string;
        email_cliente?: string;
        telefone_cliente?: string;
        cpf_cnpj_cliente?: string;
        geojson?: Record<string, any>;
    }) {
        return this.request('/api/lotes', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateLoteGeometria(loteId: number, geojson: Record<string, any>) {
        return this.request(`/api/lotes/${loteId}/geometria`, {
            method: 'PUT',
            body: JSON.stringify({ geojson }),
        });
    }

    async updateLoteStatus(loteId: number, status: string) {
        return this.request(`/api/lotes/${loteId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    }

    // ==================== TOPOLOGIA ====================

    async identificarVizinhos(loteId: number) {
        return this.request<{
            success: boolean;
            vizinhos: Array<{
                lote_id: string;
                numero: number;
                direcao: string;
                cliente: { nome: string; cpf?: string } | null;
            }>;
            vizinhos_por_direcao: Record<string, Array<unknown>>;
            total_vizinhos: number;
        }>(`/api/lotes/${loteId}/identificar-vizinhos`, { method: 'POST' });
    }

    async salvarConfrontacoes(
        loteId: number,
        vizinhos: Array<{ lote_id: string; numero: number; direcao: string }>
    ) {
        return this.request(`/api/lotes/${loteId}/salvar-confrontacoes`, {
            method: 'POST',
            body: JSON.stringify({ vizinhos }),
        });
    }

    async getConfrontacoes(loteId: number) {
        return this.request(`/api/lotes/${loteId}/confrontacoes`);
    }

    async validarTopologia(loteId: number, geojson?: Record<string, any>) {
        return this.request(`/api/lotes/${loteId}/validar-topologia`, {
            method: 'POST',
            body: JSON.stringify(geojson ? { geojson } : {}),
        });
    }

    async getSobreposicoesLote(loteId: number) {
        return this.request(`/api/lotes/${loteId}/sobreposicoes`);
    }

    // ==================== VIZINHOS MANUAIS ====================

    async addVizinho(loteId: number, nome_vizinho: string, lado: string) {
        return this.request(`/api/lotes/${loteId}/vizinhos`, {
            method: 'POST',
            body: JSON.stringify({ lote_id: loteId, nome_vizinho, lado }),
        });
    }

    async getVizinhos(loteId: number) {
        return this.request(`/api/lotes/${loteId}/vizinhos`);
    }

    // ==================== ORÇAMENTOS ====================

    async getOrcamentos(projetoId?: number, loteId?: number) {
        const params = new URLSearchParams();
        if (projetoId) params.append('projeto_id', String(projetoId));
        if (loteId) params.append('lote_id', String(loteId));
        const query = params.toString();
        const response = await this.request<unknown[]>(
            `/api/orcamentos${query ? `?${query}` : ''}`
        );
        return validateResponse(OrcamentosSchema, response, 'getOrcamentos');
    }

    async createOrcamento(data: {
        projeto_id?: number;
        lote_id?: number;
        valor: number;
        status?: string;
        observacoes?: string;
        data_emissao?: string;
        data_vencimento?: string;
        cliente_nome?: string;
    }) {
        return this.request('/api/orcamentos', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateOrcamento(
        id: number,
        data: { valor?: number; status?: string; observacoes?: string }
    ) {
        return this.request(`/api/orcamentos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteOrcamento(id: number) {
        return this.request(`/api/orcamentos/${id}`, { method: 'DELETE' });
    }

    // ==================== DESPESAS ====================

    async getDespesas(projetoId?: number) {
        const query = projetoId ? `?projeto_id=${projetoId}` : '';
        const response = await this.request<unknown[]>(`/api/despesas${query}`);
        return validateResponse(DespesasSchema, response, 'getDespesas');
    }

    async createDespesa(data: {
        projeto_id: number;
        descricao: string;
        valor: number;
        data?: string;
        data_vencimento?: string;
        categoria?: string;
        observacoes?: string;
    }) {
        return this.request('/api/despesas', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateDespesa(
        id: number,
        data: {
            descricao?: string;
            valor?: number;
            data?: string;
            data_vencimento?: string;
            categoria?: string;
            observacoes?: string;
            projeto_id?: number;
        }
    ) {
        return this.request(`/api/despesas/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteDespesa(id: number) {
        return this.request(`/api/despesas/${id}`, { method: 'DELETE' });
    }

    // ==================== PAGAMENTOS ====================

    async getPagamentos(projetoId?: number, loteId?: number) {
        const params = new URLSearchParams();
        if (projetoId) params.append('projeto_id', String(projetoId));
        if (loteId) params.append('lote_id', String(loteId));
        const query = params.toString();
        const response = await this.request<unknown[]>(
            `/api/pagamentos${query ? `?${query}` : ''}`
        );
        return validateResponse(PagamentosSchema, response, 'getPagamentos');
    }

    async createPagamento(data: {
        lote_id: number;
        valor_total: number;
        valor_pago?: number;
        status?: string;
        data_pagamento?: string;
        data_vencimento?: string;
        metodo_pagamento?: string;
        observacoes?: string;
    }) {
        return this.request('/api/pagamentos', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updatePagamento(
        id: number,
        data: {
            valor_total?: number;
            valor_pago?: number;
            status?: string;
            data_pagamento?: string;
            metodo_pagamento?: string;
            observacoes?: string;
        }
    ) {
        return this.request(`/api/pagamentos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deletePagamento(id: number) {
        return this.request(`/api/pagamentos/${id}`, { method: 'DELETE' });
    }

    // ==================== DOCUMENTOS ====================

    async getDocumentos(loteId: number) {
        return this.request<Array<{
            id: number;
            tipo: string;
            formato: string;
            arquivo_url: string;
            created_at: string;
        }>>(`/api/documents/${loteId}`);
    }

    async gerarDocumento(loteId: number, tipo: string = 'memorial') {
        return this.request<{
            id: number;
            tipo: string;
            formato: string;
            arquivo_url: string;
            created_at: string;
        }>(`/api/documents/gerar/${loteId}`, {
            method: 'POST',
            body: JSON.stringify({ lote_id: loteId, tipo }),
        });
    }
}

export const apiClient = new ApiClient(API_URL);
export default apiClient;
