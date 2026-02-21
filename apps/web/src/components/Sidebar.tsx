/**
 * Sidebar — Painéis dinâmicos por role e estado
 * Topógrafo: projetos (inclui loteamentos e lotes), editor, validar, vizinhos, peças, financeiro
 * Cliente: meus dados, desenhar, confrontações, documentos, status
 */
import { useApp, type SidebarPanel } from '../pages/AppShell';
import ProjetosPanel from './panels/ProjetosPanel';
import LotesPanel from './panels/LotesPanel';
import ValidarPanel from './panels/ValidarPanel';
import VizinhosPanel from './panels/VizinhosPanel';
import PecasPanel from './panels/PecasPanel';
import FinanceiroPanel from './panels/FinanceiroPanel';
import MeusDadosPanel from './panels/MeusDadosPanel';
import DesenharPanel from './panels/DesenharPanel';
import ConfrontacoesPanel from './panels/ConfrontacoesPanel';
import DocumentosPanel from './panels/DocumentosPanel';
import StatusPanel from './panels/StatusPanel';

import {
    FolderOpen,
    Layers,
    PenTool,
    User,
    Users,
    CheckCircle,
    Search,
    FileText,
    Upload,
    DollarSign,
    Clock,
} from 'lucide-react';

interface MenuItem {
    id: SidebarPanel;
    label: string;
    icon: React.ReactNode;
    section?: string;
}

const TOPOGRAFO_MENU: MenuItem[] = [
    { id: 'projetos', label: 'Projetos', icon: <FolderOpen size={18} /> },
    { id: 'desenhar', label: 'Editor (Desenho/CAD)', icon: <PenTool size={18} />, section: 'FERRAMENTAS' },
    { id: 'validar', label: 'Validar Desenho', icon: <CheckCircle size={18} /> },
    { id: 'vizinhos', label: 'Identificar Vizinhos', icon: <Search size={18} /> },
    { id: 'pecas', label: 'Gerar Peças', icon: <FileText size={18} /> },
    { id: 'documentos', label: 'Documentos', icon: <Upload size={18} /> },
    { id: 'financeiro', label: 'Financeiro', icon: <DollarSign size={18} />, section: 'GESTÃO' },
];

const CLIENTE_MENU: MenuItem[] = [
    { id: 'meus-dados', label: 'Meus Dados', icon: <User size={18} /> },
    { id: 'desenhar', label: 'Desenhar Área', icon: <PenTool size={18} /> },
    { id: 'confrontacoes', label: 'Confrontações', icon: <Users size={18} /> },
    { id: 'documentos', label: 'Documentos', icon: <Upload size={18} /> },
    { id: 'status', label: 'Acompanhar', icon: <Clock size={18} /> },
];

export default function Sidebar() {
    const { panel, setPanel, role, projetoAtual, loteAtual } = useApp();
    const menuItems = role === 'topografo' ? TOPOGRAFO_MENU : CLIENTE_MENU;

    let lastSection: string | undefined;

    return (
        <aside className="app-sidebar">
            <nav className="app-sidebar-nav">
                {menuItems.map((item) => {
                    const showSection = item.section && item.section !== lastSection;
                    if (item.section) lastSection = item.section;

                    return (
                        <div key={item.id}>
                            {showSection && (
                                <div className="app-sidebar-section">{item.section}</div>
                            )}
                            <button
                                className={`app-sidebar-item ${panel === item.id ? 'active' : ''}`}
                                onClick={() => setPanel(item.id)}
                                title={item.label}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        </div>
                    );
                })}
            </nav>

            {/* Painel de conteúdo */}
            <div className="app-sidebar-panel">
                <SidebarPanelContent />
            </div>

            {/* Contexto atual */}
            {(projetoAtual || loteAtual) && (
                <div className="app-sidebar-context">
                    {projetoAtual && (
                        <div className="app-sidebar-context-item">
                            <FolderOpen size={14} />
                            <span>{projetoAtual.nome}</span>
                        </div>
                    )}
                    {loteAtual && (
                        <div className="app-sidebar-context-item">
                            <Layers size={14} />
                            <span>Lote: {loteAtual.nome_cliente}</span>
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
}

/** Conteúdo do painel ativo — renderiza componentes reais */
function SidebarPanelContent() {
    const { panel } = useApp();

    switch (panel) {
        case 'projetos': return <ProjetosPanel />;
        case 'lotes': return <LotesPanel />;
        case 'validar': return <ValidarPanel />;
        case 'vizinhos': return <VizinhosPanel />;
        case 'pecas': return <PecasPanel />;
        case 'financeiro': return <FinanceiroPanel />;
        case 'meus-dados': return <MeusDadosPanel />;
        case 'desenhar': return <DesenharPanel />;
        case 'confrontacoes': return <ConfrontacoesPanel />;
        case 'documentos': return <DocumentosPanel />;
        case 'status': return <StatusPanel />;
        default: return <div className="panel-empty"><p>Painel não encontrado</p></div>;
    }
}

