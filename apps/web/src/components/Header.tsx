/**
 * Header — Barra superior do SPA
 * Logo, role badge, projeto atual, toggle sidebar, logout
 */
import { useApp } from '../pages/AppShell';
import { Map, PanelLeftClose, PanelLeft, LogOut } from 'lucide-react';

export default function Header() {
    const { role, projetoAtual, sidebarOpen, setSidebarOpen, logout } = useApp();

    return (
        <header className="app-header">
            <div className="app-header-left">
                <button
                    className="app-header-toggle"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    title={sidebarOpen ? 'Fechar sidebar' : 'Abrir sidebar'}
                >
                    {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                </button>

                <div className="app-header-brand">
                    <Map size={22} className="app-header-logo" />
                    <span className="app-header-title">Desenrola</span>
                </div>

                <span className={`app-header-badge app-header-badge--${role}`}>
                    {role === 'topografo' ? '📐 Topógrafo' : '🏠 Proprietário'}
                </span>
            </div>

            <div className="app-header-center">
                {projetoAtual && (
                    <span className="app-header-projeto">
                        📋 {projetoAtual.nome}
                    </span>
                )}
            </div>

            <div className="app-header-right">
                <button className="app-header-btn" onClick={logout} title="Sair">
                    <LogOut size={18} />
                    <span>Sair</span>
                </button>
            </div>
        </header>
    );
}
