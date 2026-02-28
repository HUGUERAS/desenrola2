/**
 * ProjetosPanel — Painel para listar e gerenciar projetos.
 * Permite criar novos projetos, selecionar um projeto para trabalhar,
 * e visualizar informações básicas de cada um.
 */
import { useState, useEffect, useCallback } from 'react';
import { useApp, type Projeto } from '../../pages/AppShell'; // Importa Projeto do AppShell types
import apiClient from '../../services/api';
import { Plus, Users, Loader2, Search, Filter, Pencil, Trash2, PlusCircle, FileText, Layers, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils'; // Função utilitária para classes CSS condicionais (tailwindcss)

interface ProjectCardProps {
    projeto: Projeto;
    isActive: boolean;
    onClick: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onAddLote?: () => void;
}

// Componente para exibir um único projeto na lista
const ProjectCard = ({
    projeto,
    isActive,
    onClick,
    onEdit,
    onDelete,
    onAddLote,
}: ProjectCardProps) => {
    const { role } = useApp(); // Para verificar se o usuário é topógrafo e pode editar/excluir
    const isTopografo = role === 'topografo';

    // Função auxiliar para formatar a data
    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/D';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return dateString; // Retorna a string original se houver erro na formatação
        }
    };

    return (
        <div
            className={cn(
                'project-card',
                isActive ? 'project-card--active' : '',
                'cursor-pointer hover:bg-gray-50'
            )}
            onClick={onClick}
        >
            <div className="project-card-header">
                <div className="project-card-title">
                    <Users size={20} className="mr-2 text-gray-500" />
                    <h4 className="text-lg font-semibold truncate max-w-[200px]">{projeto.nomeProjeto}</h4>
                </div>
                <span className={`project-status project-status--${projeto.statusProjeto?.toLowerCase() || 'rascunho'}`}>
                    {projeto.statusProjeto || 'Rascunho'}
                </span>
            </div>

            <div className="project-card-body">
                <p className="text-sm text-gray-600 truncate max-w-[250px]">Cliente: {projeto.nomeCliente || 'Sem Cliente'}</p>
                <p className="text-xs text-gray-500">{projeto.municipio}, {projeto.uf}</p>
                <div className="project-card-meta">
                    <span className="text-xs text-gray-500">Lotes: {projeto.lotes?.length || 0}</span>
                    <span className="text-xs text-gray-500">Atualizado: {formatDate(projeto.dataUltimaAtividade || projeto.dataCriacao)}</span>
                </div>
            </div>

            {isTopografo && (
                <div className="project-card-actions">
                    <button onClick={onAddLote} title="Adicionar Lote a este Projeto"><PlusCircle size={18} className="text-blue-600" /></button>
                    <button onClick={onEdit} title="Editar Projeto"><Pencil size={18} className="text-gray-600" /></button>
                    <button onClick={onDelete} title="Excluir Projeto"><Trash2 size={18} className="text-red-600" /></button>
                </div>
            )}
        </div>
    );
};

// Componente principal do Painel de Projetos
export default function ProjetosPanel() {
    const { 
        projetos, setProjetos, // Estado para a lista de projetos
        projetoAtual, setProjetoAtual, // Projeto atualmente selecionado
        activeTool, setActiveTool, // Para gerenciar ferramentas do mapa
        panel, setPanel, // Para controlar o painel ativo na sidebar
        setMapZoomTo,
        refreshUser, // Para recarregar dados do usuário se necessário
        role, // Role do usuário (topografo, etc.)
        clearSelection // Limpa a seleção do mapa quando muda de projeto
    } = useApp();

    const [loadingProjects, setLoadingProjects] = useState(true);
    const [creatingProject, setCreatingProject] = useState(false);
    const [editingProject, setEditingProject] = useState<Projeto | null>(null);
    const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);

    // Carregar projetos ao montar o componente
    useEffect(() => {
        const loadProjects = async () => {
            setLoadingProjects(true);
            try {
                const res = await apiClient.getProjects();
                if (res.data) {
                    setProjetos(res.data as Projeto[]);
                } else if (res.error) {
                    console.error("Erro ao carregar projetos:", res.error);
                    // Tratar erro (ex: exibir mensagem para o usuário)
                }
            } catch (err) {
                console.error("Erro na requisição para carregar projetos:", err);
                // Tratar erro de rede ou inesperado
            } finally {
                setLoadingProjects(false);
            }
        };
        loadProjects();
    }, [setProjetos]);

    // Handler para selecionar um projeto
    const handleSelectProject = useCallback((projeto: Projeto) => {
        setProjetoAtual(projeto);
        // Ao selecionar um novo projeto, desliga ferramentas ativas e limpa seleções do mapa
        setActiveTool(null);
        setMapZoomTo(null); // Limpa zoom anterior
        clearSelection(); // Limpa seleção de lotes/vértices no mapa
        // Opcional: Mudar o painel para o de lotes desse projeto
        // setPanel('lotes');
    }, [setProjetoAtual, setActiveTool, setMapZoomTo, clearSelection, setPanel]);

    // Handler para criar um novo projeto
    const handleCreateProject = async (newProjectData: Omit<Projeto, 'id' | 'statusProjeto' | 'dataCriacao' | 'dataUltimaAtividade' | 'responsavelTopografoId' | 'lotes'>) => {
        setCreatingProject(true);
        try {
            // API espera Dict, mas nosso model é Projeto. Precisamos mapear.
            const payload = {
                nomeProjeto: newProjectData.nomeProjeto,
                nomeCliente: newProjectData.nomeCliente,
                cpfCnpjCliente: newProjectData.cpfCnpjCliente,
                municipio: newProjectData.municipio,
                uf: newProjectData.uf,
                // statusProjeto e outros campos são definidos no backend
            };
            const res = await apiClient.createProject(payload);
            if (res.data) {
                // Atualiza a lista de projetos localmente com o novo projeto
                setProjetos(prev => [...prev, res.data as Projeto]);
                toast.sonner.success('Projeto criado com sucesso!');
                return true; // Indica sucesso
            } else {
                throw new Error(res.error || 'Falha ao criar projeto');
            }
        } catch (err: any) {
            console.error('Erro ao criar projeto:', err);
            toast.error(err.message || 'Falha ao criar projeto');
            return false; // Indica falha
        } finally {
            setCreatingProject(false);
        }
    };

    // Handler para editar um projeto
    const handleEditProject = async (projectId: number, updatedData: Partial<Omit<Projeto, 'id' | 'statusProjeto' | 'dataCriacao' | 'dataUltimaAtividade' | 'responsavelTopografoId' | 'lotes'>>) => {
        setEditingProject({ ...editingProject!, ...updatedData }); // Atualiza estado local para re-renderizar o form
        try {
            const res = await apiClient.updateProject(projectId, updatedData);
            if (res.data) {
                // Atualiza a lista de projetos localmente
                setProjetos(prev => prev.map(p => p.id === projectId ? res.data as Projeto : p));
                toast.success('Projeto atualizado com sucesso!');
                setEditingProject(null); // Fecha o modal de edição
                return true;
            } else {
                throw new Error(res.error || 'Falha ao atualizar projeto');
            }
        } catch (err: any) {
            console.error('Erro ao editar projeto:', err);
            toast.error(err.message || 'Falha ao editar projeto');
            return false;
        }
    };

    // Handler para excluir um projeto
    const handleDeleteProject = async (projectId: number) => {
        setDeletingProjectId(projectId);
        try {
            const res = await apiClient.deleteProject(projectId);
            if (res.data) { // Supabase delete retorna { count: 1 } em caso de sucesso
                setProjetos(prev => prev.filter(p => p.id !== projectId));
                // Se o projeto excluído era o projeto atual, desmarca-o
                if (projetoAtual?.id === projectId) {
                    setProjetoAtual(null);
                }
                toast.success('Projeto excluído com sucesso!');
                setDeletingProjectId(null);
            } else {
                throw new Error(res.error || 'Falha ao excluir projeto');
            }
        } catch (err: any) {
            console.error('Erro ao excluir projeto:', err);
            toast.error(err.message || 'Falha ao excluir projeto');
            setDeletingProjectId(null);
            return false;
        }
    };

    // --- Lógica do Modal de Criação/Edição ---
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [currentProjectForm, setCurrentProjectForm] = useState<Omit<Projeto, 'id' | 'statusProjeto' | 'dataCriacao' | 'dataUltimaAtividade' | 'responsavelTopografoId' | 'lotes'> | null>(null);

    const openCreateModal = () => {
        setCurrentProjectForm({ nomeProjeto: '', nomeCliente: '', cpfCnpjCliente: '', municipio: '', uf: '', statusProjeto: 'Rascunho' } as any);
        setShowProjectModal(true);
    };

    const openEditModal = (projeto: Projeto) => {
        setCurrentProjectForm({
            id: projeto.id,
            nomeProjeto: projeto.nomeProjeto,
            nomeCliente: projeto.nomeCliente,
            cpfCnpjCliente: projeto.cpfCnpjCliente,
            municipio: projeto.municipio,
            uf: projeto.uf,
            statusProjeto: projeto.statusProjeto || 'Rascunho',
            descricao: projeto.descricao,
        } as any);
        setShowProjectModal(true);
    };

    const handleSaveProject = async (formData: Omit<Projeto, 'id' | 'statusProjeto' | 'dataCriacao' | 'dataUltimaAtividade' | 'responsavelTopografoId' | 'lotes'> & { id?: number }) => {
        if (formData.id) { // Edição
            return handleEditProject(formData.id, formData as Partial<Omit<Projeto, 'id' | 'statusProjeto' | 'dataCriacao' | 'dataUltimaAtividade' | 'responsavelTopografoId' | 'lotes'>>);
        } else { // Criação
            return handleCreateProject(formData as Omit<Projeto, 'id' | 'statusProjeto' | 'dataCriacao' | 'dataUltimaAtividade' | 'responsavelTopografoId' | 'lotes'>);
        }
    };

    // Componente simples para o modal de form
    const ProjectFormModal = ({ project, onClose, onSave, isCreating }: {
        project: Omit<Projeto, 'id' | 'statusProjeto' | 'dataCriacao' | 'dataUltimaAtividade' | 'responsavelTopografoId' | 'lotes'> & { id?: number } | null;
        onClose: () => void;
        onSave: (data: Omit<Projeto, 'id' | 'statusProjeto' | 'dataCriacao' | 'dataUltimaAtividade' | 'responsavelTopografoId' | 'lotes'> & { id?: number }) => Promise<boolean>;
        isCreating: boolean;
    }) => {
        const [formData, setFormData] = useState(project || {
            nomeProjeto: '', nomeCliente: '', cpfCnpjCliente: '', municipio: '', uf: '', statusProjeto: 'Rascunho', descricao: ''
        });
        const [saving, setSaving] = useState(false);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        const handleSubmit = async () => {
            setSaving(true);
            const success = await onSave(formData as any);
            setSaving(false);
            if (success) {
                onClose();
            }
        };

        return (
            <div className="modal-backdrop">
                <div className="modal-content">
                    <div className="modal-header">
                        <h3>{formData.id ? 'Editar Projeto' : 'Novo Projeto'}</h3>
                        <button onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <label>Nome do Projeto *</label>
                        <input type="text" name="nomeProjeto" value={formData.nomeProjeto} onChange={handleChange} required />

                        <label>Nome do Cliente *</label>
                        <input type="text" name="nomeCliente" value={formData.nomeCliente} onChange={handleChange} required />

                        <label>CPF/CNPJ do Cliente</label>
                        <input type="text" name="cpfCnpjCliente" value={formData.cpfCnpjCliente || ''} onChange={handleChange} />

                        <label>Município</label>
                        <input type="text" name="municipio" value={formData.municipio || ''} onChange={handleChange} />

                        <label>UF</label>
                        <input type="text" name="uf" value={formData.uf || ''} onChange={handleChange} maxLength={2} style={{ width: '60px' }} />

                        <label>Status</label>
                        <select name="statusProjeto" value={formData.statusProjeto || 'Rascunho'} onChange={handleChange} >
                            <option value="Rascunho">Rascunho</option>
                            <option value="Em Andamento">Em Andamento</option>
                            <option value="Aguardando Aprovação">Aguardando Aprovação</option>
                            <option value="Concluído">Concluído</option>
                            <option value="Pausado">Pausado</option>
                            <option value="Cancelado">Cancelado</option>
                        </select>

                        <label>Descrição</label>
                        <textarea name="descricao" value={formData.descricao || ''} onChange={handleChange} rows={3} />
                    </div>
                    <div className="modal-footer">
                        <button onClick={onClose} disabled={saving}>Cancelar</button>
                        <button onClick={handleSubmit} disabled={saving || !formData.nomeProjeto || !formData.nomeCliente}>
                            {saving ? <><Loader2 size={14} className='spin'/> Salvando...</> : 'Salvar'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Remover o modal de edição existente se houver e adicionar o novo
    // Isso pode ser otimizado, mas para a correção rápida funciona.
    // Idealmente, a lógica de modal deve ser mais genérica.

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>👥 Projetos</h3>
                {role === 'topografo' && (
                    <button className="panel-btn panel-btn--sm" onClick={openCreateModal}>
                        <Plus size={14} /> Novo Projeto
                    </button>
                )}
            </div>

            {loadingProjects ? (
                <div className="panel-loading"><Loader2 size={20} className="spin" /> Carregando projetos...</div>
            ) : projetos.length === 0 ? (
                <div className="panel-empty">
                    <Users size={24} />
                    <p>Nenhum projeto encontrado.</p>
                    {role === 'topografo' && (
                        <button className="panel-btn panel-btn--primary" onClick={openCreateModal}>
                            <Plus size={14} /> Criar Novo Projeto
                        </button>
                    )}
                </div>
            ) : (
                <div className="project-list">
                    {projetos.map((p) => (
                        <ProjectCard
                            key={p.id}
                            projeto={p}
                            isActive={projetoAtual?.id === p.id}
                            onClick={() => handleSelectProject(p)}
                            onEdit={() => openEditModal(p)}
                            onDelete={() => {
                                // Confirmação antes de deletar
                                if (window.confirm(`Tem certeza que deseja excluir o projeto "${p.nomeProjeto}"?`)) {
                                    handleDeleteProject(p.id);
                                }
                            }}
                            onAddLote={() => {
                                // Lógica para adicionar lote a este projeto
                                // Poderia abrir o painel de lotes ou navegar para a tela de lotes
                                alert('Funcionalidade Adicionar Lote a Projeto ainda não implementada.');
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Renderiza o Modal de Criação/Edição */} 
            {showProjectModal && currentProjectForm && (
                <ProjectFormModal
                    project={currentProjectForm}
                    onClose={() => setShowProjectModal(false)}
                    onSave={handleSaveProject}
                    isCreating={!currentProjectForm.id}
                />
            )}
        </div>
    );
}
