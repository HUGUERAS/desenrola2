/**
 * DocumentosPanel — Gerenciamento de documentos
 * Topógrafo: Gera peças técnicas (Memorial, Plantas)
 * Cliente: Envia documentos pessoais (RG, Escritura)
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { Upload, FileText, CheckCircle, Loader2, Download, AlertCircle } from 'lucide-react';

interface DocSlot {
    id: string;
    label: string;
    icon: string;
    required: boolean;
    uploaded: boolean;
    fileName?: string;
    url?: string;
}

interface GeneratedDoc {
    id: number;
    tipo: string;
    arquivo_url: string;
    created_at: string;
}

export default function DocumentosPanel() {
    const { loteAtual, role } = useApp();
    const [activeTab, setActiveTab] = useState<'upload' | 'gerados'>('upload');

    // Estado Cliente (Uploads)
    const [slots, setSlots] = useState<DocSlot[]>([
        { id: 'escritura', label: 'Escritura / Contrato', icon: '📜', required: true, uploaded: false },
        { id: 'iptu', label: 'IPTU ou Carnê', icon: '🏠', required: false, uploaded: false },
        { id: 'rg', label: 'RG ou CNH', icon: '🪪', required: true, uploaded: false },
        { id: 'cpf', label: 'CPF', icon: '📋', required: true, uploaded: false },
        { id: 'comprovante', label: 'Comprovante Residência', icon: '📮', required: false, uploaded: false },
    ]);
    const [uploading, setUploading] = useState<string | null>(null);

    // Estado Topógrafo (Geração)
    const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);
    const [generating, setGenerating] = useState(false);
    const [loadingDocs, setLoadingDocs] = useState(false);

    // Carregar documentos gerados ao abrir
    useEffect(() => {
        if (loteAtual && activeTab === 'gerados') {
            loadGeneratedDocs();
        }
    }, [loteAtual, activeTab]);

    // Se for topógrafo, padrão é aba de gerados
    useEffect(() => {
        if (role === 'topografo') setActiveTab('gerados');
    }, [role]);

    const loadGeneratedDocs = async () => {
        if (!loteAtual) return;
        setLoadingDocs(true);
        const res = await apiClient.getDocumentos(loteAtual.id);
        if (res.data) setGeneratedDocs(res.data);
        setLoadingDocs(false);
    };

    const handleUpload = async (slotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(slotId);
        // Mock de upload
        await new Promise((r) => setTimeout(r, 1000));
        setSlots((prev) =>
            prev.map((s) =>
                s.id === slotId ? { ...s, uploaded: true, fileName: file.name } : s
            )
        );
        setUploading(null);
    };

    const handleGerarMemorial = async () => {
        if (!loteAtual) return;
        setGenerating(true);
        try {
            const res = await apiClient.gerarDocumento(loteAtual.id, 'memorial');
            if (res.data) {
                await loadGeneratedDocs();
                toast.success('Documento gerado com sucesso!');
            } else {
                toast.error('Erro ao gerar documento: ' + (res.error ?? 'Erro desconhecido'));
            }
        } catch (err) {
            console.error(err);
            toast.error('Erro ao gerar documento.');
        } finally {
            setGenerating(false);
        }
    };

    const totalRequired = slots.filter((s) => s.required).length;
    const uploadedRequired = slots.filter((s) => s.required && s.uploaded).length;
    const progress = Math.round((uploadedRequired / totalRequired) * 100);

    if (!loteAtual) {
        return (
            <div className="panel">
                <div className="panel-empty">
                    <FileText size={24} />
                    <p>Selecione um lote para gerenciar documentos</p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>📂 Documentos do Lote</h3>
            </div>

            {/* Abas */}
            <div className="panel-tabs" style={{ display: 'flex', gap: '8px', padding: '0 16px', marginBottom: '16px' }}>
                <button
                    className={`btn-tab ${activeTab === 'upload' ? 'active' : ''}`}
                    onClick={() => setActiveTab('upload')}
                    style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #334155', background: activeTab === 'upload' ? '#334155' : 'transparent', color: 'white', cursor: 'pointer' }}
                >
                    <Upload size={14} style={{ display: 'inline', marginRight: 4 }} />
                    Enviados
                </button>
                <button
                    className={`btn-tab ${activeTab === 'gerados' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gerados')}
                    style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #334155', background: activeTab === 'gerados' ? '#334155' : 'transparent', color: 'white', cursor: 'pointer' }}
                >
                    <FileText size={14} style={{ display: 'inline', marginRight: 4 }} />
                    Técnicos
                </button>
            </div>

            {/* Conteúdo: Uploads (Cliente) */}
            {activeTab === 'upload' && (
                <>
                    <div className="panel-progress">
                        <div className="panel-progress-bar">
                            <div className="panel-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="panel-progress-text">
                            {uploadedRequired}/{totalRequired} obrigatórios
                        </span>
                    </div>

                    <div className="panel-list">
                        {slots.map((slot) => (
                            <div key={slot.id} className={`panel-doc-slot ${slot.uploaded ? 'uploaded' : ''}`}>
                                <div className="panel-doc-header">
                                    <span>{slot.icon} {slot.label}</span>
                                    {slot.required && !slot.uploaded && (
                                        <span className="panel-doc-required">Obrigatório</span>
                                    )}
                                    {slot.uploaded && <CheckCircle size={14} className="text-success" />}
                                </div>
                                {slot.uploaded && slot.fileName && (
                                    <p className="panel-doc-file">{slot.fileName}</p>
                                )}
                                <label className="panel-upload panel-upload--sm">
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                        onChange={(e) => handleUpload(slot.id, e)}
                                        hidden
                                    />
                                    {uploading === slot.id
                                        ? <><Loader2 size={12} className="spin" /> Enviando...</>
                                        : slot.uploaded
                                            ? <><Upload size={12} /> Substituir</>
                                            : <><Upload size={12} /> Enviar</>}
                                </label>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Conteúdo: Gerados (Topógrafo) */}
            {activeTab === 'gerados' && (
                <div className="panel-content">
                    {role === 'topografo' && (
                        <div className="panel-actions" style={{ marginBottom: '16px' }}>
                            <button
                                className="btn btn-primary btn-full"
                                onClick={handleGerarMemorial}
                                disabled={generating}
                            >
                                {generating ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
                                Gerar Memorial Descritivo
                            </button>
                        </div>
                    )}

                    {loadingDocs ? (
                        <div className="panel-loading"><Loader2 className="spin" /> Carregando...</div>
                    ) : generatedDocs.length === 0 ? (
                        <div className="panel-empty-state">
                            <AlertCircle size={24} className="text-muted" />
                            <p>Nenhum documento gerado ainda.</p>
                        </div>
                    ) : (
                        <div className="panel-list">
                            {generatedDocs.map((doc) => (
                                <div key={doc.id} className="panel-item">
                                    <div className="panel-item-icon">
                                        <FileText size={18} />
                                    </div>
                                    <div className="panel-item-content">
                                        <strong>{doc.tipo.toUpperCase()}</strong>
                                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <a
                                        href={doc.arquivo_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-icon"
                                        title="Baixar"
                                    >
                                        <Download size={16} />
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
