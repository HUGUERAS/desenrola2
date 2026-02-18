/**
 * AppShell — Layout SPA principal
 * Mapa SEMPRE visível + sidebar com painéis dinâmicos
 */
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import apiClient from '../services/api';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import StatusBar from '../components/StatusBar';
import MapContainer, { type LoteGeometry } from '../components/maps/MapContainer';
import '../styles/app-shell.css';
import '../styles/map.css';

// ── Tipos ──

export type SidebarPanel =
    | 'projetos'
    | 'lotes'
    | 'desenhar'
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
}

interface AppContextValue extends AppState {
    setPanel: (panel: SidebarPanel) => void;
    setProjetoAtual: (projeto: Projeto | null) => void;
    setLoteAtual: (lote: Lote | null) => void;
    setSidebarOpen: (open: boolean) => void;
    setCursorCoords: (coords: { lat: number; lon: number } | null) => void;
    setMapGeometries: (geoms: LoteGeometry[]) => void;
    handleGeometryChange: (wkt: string) => void;
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
    const [state, setState] = useState<AppState>({
        panel: 'projetos',
        role: 'proprietario',
        projetoAtual: null,
        loteAtual: null,
        sidebarOpen: true,
        mapCursor: null,
        mapGeometries: [],
    });

    const [loading, setLoading] = useState(true);

    // Verificar autenticação e role ao montar
    // Verificar autenticação e role ao montar
    useEffect(() => {
        const init = async () => {
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
                                // Tentar achar o projeto dele
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
                    // Se não tiver sessão, redirecionar para login
                    window.location.href = '/login';
                }
            } catch (err) {
                console.error('Erro ao inicializar:', err);
                // Fallback também em caso de erro
                setState((prev) => ({ ...prev, role: 'topografo', panel: 'projetos' }));
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleGeometryChange = useCallback(async (wkt: string) => {
        if (state.loteAtual) {
            apiClient.updateLoteGeometria(state.loteAtual.id, wkt).catch(console.error);
        } else if (state.role === 'proprietario') {
            // Auto-criar lote para cliente que começou a desenhar
            console.log('Iniciando auto-criação de lote...');
            const res = await apiClient.autoCreateLote(wkt);
            if (res.data) {
                console.log('Lote criado com sucesso!');
                const novoLote = res.data as unknown as Lote;
                setState(prev => ({ ...prev, loteAtual: novoLote }));
            } else if (res.error) {
                console.error('Falha na auto-criação:', res.error);
                alert('Erro ao salvar sua área: ' + res.error);
            }
        }
    }, [state.loteAtual, state.role]);

    const contextValue: AppContextValue = {
        ...state,
        setPanel: (panel) => setState((prev) => ({ ...prev, panel })),
        setProjetoAtual: (projeto) =>
            setState((prev) => ({ ...prev, projetoAtual: projeto, loteAtual: null })),
        setLoteAtual: (lote) => setState((prev) => ({ ...prev, loteAtual: lote })),
        setSidebarOpen: (open) => setState((prev) => ({ ...prev, sidebarOpen: open })),
        setCursorCoords: (coords) => setState((prev) => ({ ...prev, mapCursor: coords })),
        setMapGeometries: (geoms) => setState((prev) => ({ ...prev, mapGeometries: geoms })),
        handleGeometryChange,
        logout: async () => {
            await supabase.auth.signOut();
            apiClient.logout();
            window.location.href = '/login';
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
                            onGeometryChange={handleGeometryChange}
                            onLoteClick={(id) => {
                                const lote = state.mapGeometries.find((l) => l.id === id);
                                if (lote) {
                                    setState((prev) => ({
                                        ...prev,
                                        loteAtual: { id: lote.id, projeto_id: 0, nome_cliente: lote.label || '', geom: lote.wkt },
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
