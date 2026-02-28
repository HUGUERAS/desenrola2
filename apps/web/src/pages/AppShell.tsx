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
import ProjetosPanel from '../components/panels/ProjetosPanel'; // Importar o novo painel
import MapContainer, { type LoteGeometry } from '../components/maps/MapContainer';
import type { ToolId, ToolCategory, ToolResult, LayerConfig } from '../types/tools';
import AppLoading from '../features/app-shell/components/AppLoading';
import { initialAppState, type AppState, type Lote, type Projeto, type SidebarPanel, type UserRole } from '../features/app-shell/types';
import {
    buildDrawingGeometry,
    buildMapClickLote,
    mapUnknownLotesToGeometries,
    removeToolLayer,
    replaceDraftGeometry,
    resolveInitialPanel,
    upsertGeometry,
    upsertToolLayer,
} from '../features/app-shell/utils';
import ToolInstruction from '../components/tools/ToolInstruction';
import '../styles/app-shell.css';
import '../styles/map.css';
import '../styles/tool-instruction.css';

// ── Tipos ──
export type { SidebarPanel, UserRole, Projeto, Lote, AppState };

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
    setMapZoomTo: (geojson: Record<string, any> | null) => void;
    refreshUser: () => Promise<void>;
    logout: () => void;
    // Estados de Gerenciamento de Projetos
    projetos: Projeto[];
    setProjetos: (proj: Projeto[]) => void;
    projetoAtual: Projeto | null;
    setProjetoAtual: (proj: Projeto | null) => void;
    // Sistema de seleção
    selectedPolygons: string[]; // IDs dos polígonos selecionados
    setSelectedPolygons: (ids: string[]) => void;
    togglePolygonSelection: (id: string, multiSelect?: boolean) => void;
    clearSelection: () => void;
    bufferDistance: number;
    setBufferDistance: (dist: number) => void;
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
    const [state, setState] = useState<AppState>(initialAppState);
    const [selectedPolygons, setSelectedPolygons] = useState<string[]>([]);
    const [bufferDistance, setBufferDistance] = useState<number>(10);
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
                            const geometries: LoteGeometry[] = mapUnknownLotesToGeometries(lotesRes.data);
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
                        panel: resolveInitialPanel(role, lote),
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
        // Atualiza a geometria temporária (id: 0) ou a do lote atual no estado local
        const targetId = state.loteAtual?.id ?? 0;

        setState(prev => {
            const newGeom: LoteGeometry = buildDrawingGeometry(targetId, geojson, prev.loteAtual?.nome_cliente);
            return {
                ...prev,
                mapGeometries: upsertGeometry(prev.mapGeometries, newGeom)
            };
        });

        // Se já for um lote existente, podemos salvar o ajuste automaticamente em background
        if (state.loteAtual) {
            apiClient.updateLoteGeometria(state.loteAtual.id, geojson).catch(console.error);
        }
    }, [state.loteAtual]);

    // 2. Salva permanentemente no banco (Manual via botão)
    const handleSaveDrawing = useCallback(async (geojson: Record<string, any>) => {
        if (!state.role) return { ok: false };

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
                mapGeometries: replaceDraftGeometry(prev.mapGeometries, novaGeom),
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
        updateToolLayer: (layer) =>
            setState((prev) => ({ ...prev, toolLayers: upsertToolLayer(prev.toolLayers, layer) })),
        removeToolLayer: (layerId) => setState((prev) => ({
            ...prev,
            toolLayers: removeToolLayer(prev.toolLayers, layerId),
        })),
        setSketchTool: (tool) => setState((prev) => ({ ...prev, sketchTool: tool })),
        setMapZoomTo: (geojson) => setState((prev) => ({ ...prev, mapZoomTo: geojson })),
        refreshUser: initUser,
        logout: async () => {
            await supabase.auth.signOut();
            apiClient.logout();
            navigate('/login');
        },
        // Funções de seleção
        selectedPolygons,
        setSelectedPolygons,
        togglePolygonSelection: (id: string, multiSelect = false) => {
            setSelectedPolygons((prev) => {
                if (multiSelect) {
                    // Multi-seleção (Ctrl+Click)
                    return prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
                } else {
                    // Seleção única
                    return prev.includes(id) && prev.length === 1 ? [] : [id];
                }
            });
        },
        clearSelection: () => setSelectedPolygons([]),
        bufferDistance,
        setBufferDistance,
    };

    if (loading) {
        return <AppLoading />;
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
                            zoomTo={state.mapZoomTo}
                            onGeometryChange={handleMapDrawingChange}
                            onLoteClick={async (id) => {
                                const fallback = state.mapGeometries.find((l) => l.id === id);
                                if (id > 0) {
                                    const loteRes = await apiClient.getLote(id);
                                    if (loteRes.data && typeof loteRes.data === 'object') {
                                        const lote = loteRes.data as Lote;
                                        let projeto = state.projetoAtual;

                                        if (!projeto || projeto.id !== lote.projeto_id) {
                                            const projsRes = await apiClient.getProjects();
                                            if (projsRes.data) {
                                                projeto =
                                                    (projsRes.data.find((p) => p.id === lote.projeto_id) as unknown as Projeto) ||
                                                    null;
                                            }
                                        }

                                        setState((prev) => ({
                                            ...prev,
                                            loteAtual: lote,
                                            projetoAtual: projeto,
                                        }));
                                        return;
                                    }
                                }

                                if (fallback) {
                                    setState((prev) => ({
                                        ...prev,
                                        loteAtual: buildMapClickLote(fallback),
                                    }));
                                }
                            }}
                        />
                        <ToolInstruction />
                    </main>
                </div>
                <StatusBar />
            </div>
        </AppContext.Provider>
    );
}
