/**
 * AppShell — Layout SPA principal
 * Mapa SEMPRE visível + sidebar com painéis dinâmicos
 */
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import StatusBar from '../components/StatusBar';
import MapContainer, { type LoteGeometry } from '../components/maps/MapContainer';
import type { ToolId, ToolCategory, ToolResult, LayerConfig } from '../types/tools';
import '../styles/app-shell.css';
import '../styles/map.css';

// ── Tipos ──

export type SidebarPanel =
    | 'projetos'
    | 'loteamentos'
    | 'lotes'
    | 'desenhar'
    | 'ferramentas'
    | 'camadas'
    | 'meus-dados'
    | 'confrontacoes'
    | 'validar'
    | 'vizinhos'
    | 'pecas'
    | 'documentos'
    | 'financeiro'
    | 'status';

export type UserRole = 'topografo' | 'proprietario';

export interface Projeto {
    id: number;
    nome: string;
    descricao?: string;
    tipo?: string;
    status?: string;
}

export interface Lote {
    id: number;
    projeto_id: number;
    nome_cliente: string;
    email_cliente?: string;
    geom?: string;
    geojson?: Record<string, any>;
    status?: string;
}

export interface AppState {
    panel: SidebarPanel;
    role: UserRole;
    projetoAtual: Projeto | null;
    loteAtual: Lote | null;
    sidebarOpen: boolean;
    mapCursor: { lat: number; lon: number } | null;
    mapGeometries: LoteGeometry[];
    activeTool: ToolId | null;
    activeToolCategory: ToolCategory;
    toolResult: ToolResult | null;
    toolLayers: LayerConfig[];
    sketchTool: string | null;
}

interface AppContextValue extends AppState {
    setPanel: (panel: SidebarPanel) => void;
    setProjetoAtual: (projeto: Projeto | null) => void;
    setLoteAtual: (lote: Lote | null) => void;
    setSidebarOpen: (open: boolean) => void;
    setCursorCoords: (coords: { lat: number; lon: number } | null) => void;
    setMapGeometries: (geoms: LoteGeometry[]) => void;
    handleMapDrawingChange: (geojson: Record<string, any>) => void;
    handleSaveDrawing: (geojson: Record<string, any>) => Promise<{ ok: boolean }>;
    setActiveTool: (tool: ToolId | null) => void;
    setActiveToolCategory: (category: ToolCategory) => void;
    setToolResult: (result: ToolResult | null) => void;
    updateToolLayer: (layer: LayerConfig) => void;
    removeToolLayer: (layerId: string) => void;
    setSketchTool: (tool: string | null) => void;
    refreshUser: () => Promise<void>;
    logout: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);
export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppShell');
    return ctx;
};

// ── Component ──

export default function AppShell() {
    const navigate = useNavigate();
    const [state, setState] = useState<AppState>({
        panel: 'projetos',
        role: 'proprietario',
        projetoAtual: null,
        loteAtual: null,
        sidebarOpen: true,
        mapCursor: null,
        mapGeometries: [],
        activeTool: null,
        activeToolCategory: 'medicao',
        toolResult: null,
        sketchTool: null,
        toolLayers: [
            { id: 'lotes-layer', title: 'Lotes', visible: true, opacity: 100, type: 'base' },
            { id: 'desenho-layer', title: 'Desenho', visible: true, opacity: 100, type: 'base' },
        ],
    });

    const [loading, setLoading] = useState(true);

    const initUser = useCallback(async () => {
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (session?.access_token) {
                apiClient.setToken(session.access_token);
                const perfilRes = await apiClient.getPerfilMe();
                if (perfilRes.data) {
                    const role = (perfilRes.data.role as UserRole) || 'proprietario';
                    let lote: Lote | null = null;
                    let projeto: Projeto | null = null;

                    if (role === 'proprietario') {
                        const lotesRes = await apiClient.getMyLotes();
                        if (lotesRes.data && lotesRes.data.length > 0) {
                            lote = lotesRes.data[0] as unknown as Lote;
                            const geometries: LoteGeometry[] = lotesRes.data.map((l: any) => ({
                                id: l.id,
                                wkt: l.geom,
                                geojson: l.geojson,
                                label: l.nome_cliente,
                                type: l.status === 'APROVADO' ? 'oficial' : 'rascunho'
                            }));
                            setState(prev => ({ ...prev, mapGeometries: geometries }));

                            const projsRes = await apiClient.getProjects();
                            projeto = projsRes.data?.find(p => p.id === lote?.projeto_id) as unknown as Projeto || null;
                        }
                    }

                    setState((prev) => ({
                        ...prev,
                        role,
                        loteAtual: lote,
                        projetoAtual: projeto,
                        panel: role === 'topografo' ? 'projetos' : (lote ? 'status' : 'desenhar'),
                    }));
                }
            } else {
                navigate('/login');
            }
        } catch (err) {
            console.error('Erro ao inicializar:', err);
            setState((prev) => ({ ...prev, role: 'topografo', panel: 'projetos' }));
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    // Verificar autenticação e role ao montar
    useEffect(() => {
        initUser();
    }, [initUser]);

    // 1. Atualiza apenas o mapa (local)
    const handleMapDrawingChange = useCallback((geojson: Record<string, any>) => {
        console.log('[DEBUG] Desenho no mapa alterado:', geojson);

        // Atualiza a geometria temporária (id: 0) ou a do lote atual no estado local
        const targetId = state.loteAtual?.id ?? 0;

        setState(prev => {
            const exists = prev.mapGeometries.find(g => g.id === targetId);
            const newGeom: LoteGeometry = {
                id: targetId,
                geojson: geojson,
                type: targetId === 0 ? 'rascunho' : 'ativo',
                label: targetId === 0 ? 'Nova Área' : prev.loteAtual?.nome_cliente
            };

            if (exists) {
                return {
                    ...prev,
                    mapGeometries: prev.mapGeometries.map(g => g.id === targetId ? newGeom : g)
                };
            } else {
                return {
                    ...prev,
                    mapGeometries: [...prev.mapGeometries, newGeom]
                };
            }
        });

        // Se já for um lote existente, podemos salvar o ajuste automaticamente em background
        if (state.loteAtual) {
            apiClient.updateLoteGeometria(state.loteAtual.id, geojson).catch(console.error);
        }
    }, [state.loteAtual]);

    // 2. Salva permanentemente no banco (Manual via botão)
    const handleSaveDrawing = useCallback(async (geojson: Record<string, any>) => {
        if (!state.role) return { ok: false };

        console.log('[DEBUG] Solicitando salvamento permanente...');
        const res = await apiClient.autoCreateLote(geojson);

        if (res.data) {
            const novoLote = res.data as unknown as Lote;
            const novaGeom: LoteGeometry = {
                id: novoLote.id,
                geojson: novoLote.geojson || geojson,
                label: novoLote.nome_cliente,
                type: 'oficial'
            };

            setState(prev => ({
                ...prev,
                loteAtual: novoLote,
                mapGeometries: prev.mapGeometries
                    .filter(g => g.id !== 0) // Remove o temporário
                    .concat(novaGeom)
            }));
            // Avisa o App Shell sobre a nova geometria
            handleMapDrawingChange(geojson);
            return { ok: true };
        } else {
            console.error('Erro ao salvar:', res.error);
            throw new Error(res.error || 'Falha ao salvar');
        }
    }, [state.role, handleMapDrawingChange]);

    const handleGeometryChange = handleMapDrawingChange; // Para compatibilidade temporária se necessário

    const contextValue: AppContextValue = {
        ...state,
        setPanel: (panel) => setState((prev) => ({ ...prev, panel })),
        setProjetoAtual: (projeto) =>
            setState((prev) => ({ ...prev, projetoAtual: projeto, loteAtual: null })),
        setLoteAtual: (lote) => setState((prev) => ({ ...prev, loteAtual: lote })),
        setSidebarOpen: (open) => setState((prev) => ({ ...prev, sidebarOpen: open })),
        setCursorCoords: (coords) => setState((prev) => ({ ...prev, mapCursor: coords })),
        setMapGeometries: (geoms) => setState((prev) => ({ ...prev, mapGeometries: geoms })),
        handleMapDrawingChange,
        handleSaveDrawing,
        setActiveTool: (tool) => setState((prev) => ({ ...prev, activeTool: tool, toolResult: tool ? prev.toolResult : null })),
        setActiveToolCategory: (category) => setState((prev) => ({ ...prev, activeToolCategory: category })),
        setToolResult: (result) => setState((prev) => ({ ...prev, toolResult: result })),
        updateToolLayer: (layer) => setState((prev) => {
            const exists = prev.toolLayers.find(l => l.id === layer.id);
            if (exists) {
                return { ...prev, toolLayers: prev.toolLayers.map(l => l.id === layer.id ? layer : l) };
            }
            return { ...prev, toolLayers: [...prev.toolLayers, layer] };
        }),
        removeToolLayer: (layerId) => setState((prev) => ({
            ...prev,
            toolLayers: prev.toolLayers.filter(l => l.id !== layerId),
        })),
        setSketchTool: (tool) => setState((prev) => ({ ...prev, sketchTool: tool })),
        refreshUser: initUser,
        logout: async () => {
            await supabase.auth.signOut();
            apiClient.logout();
            navigate('/login');
        },
    };

    if (loading) {
        return (
            <div className="app-loading">
                <div className="app-loading-spinner" />
                <p>Carregando Desenrola...</p>
            </div>
        );
    }

    return (
        <AppContext.Provider value={contextValue}>
            <div className="app-shell">
                <Header />
                <div className="app-body">
                    {state.sidebarOpen && <Sidebar />}
                    <main className="app-map-area">
                        <MapContainer
                            lotes={state.mapGeometries}
                            drawingEnabled={state.panel === 'desenhar'}
                            onGeometryChange={handleMapDrawingChange}
                            onLoteClick={(id) => {
                                const lote = state.mapGeometries.find((l) => l.id === id);
                                if (lote) {
                                    setState((prev) => ({
                                        ...prev,
                                        loteAtual: {
                                            id: lote.id,
                                            projeto_id: 0,
                                            nome_cliente: lote.label || '',
                                            geom: lote.wkt,
                                            geojson: lote.geojson
                                        },
                                    }));
                                }
                            }}
                        />
                    </main>
                </div>
                <StatusBar />
            </div>
        </AppContext.Provider>
    );
}
