/**
 * DocumentosPanel — Upload de documentos pelo cliente
 */
import { useState } from 'react';
import { useApp } from '../../pages/AppShell';
import { Upload, File, CheckCircle, Loader2 } from 'lucide-react';

interface DocSlot {
    id: string;
    label: string;
    icon: string;
    required: boolean;
    uploaded: boolean;
    fileName?: string;
}

export default function DocumentosPanel() {
    const { loteAtual } = useApp();
    const [slots, setSlots] = useState<DocSlot[]>([
        { id: 'escritura', label: 'Escritura / Contrato', icon: '📜', required: true, uploaded: false },
        { id: 'iptu', label: 'IPTU ou Carnê', icon: '🏠', required: false, uploaded: false },
        { id: 'rg', label: 'RG ou CNH', icon: '🪪', required: true, uploaded: false },
        { id: 'cpf', label: 'CPF', icon: '📋', required: true, uploaded: false },
        { id: 'comprovante', label: 'Comprovante de Residência', icon: '📮', required: false, uploaded: false },
        { id: 'fotos', label: 'Fotos do Terreno', icon: '📷', required: false, uploaded: false },
    ]);
    const [uploading, setUploading] = useState<string | null>(null);

    const handleUpload = async (slotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(slotId);
        // Fase futura: upload real para Supabase Storage
        await new Promise((r) => setTimeout(r, 1000));
        setSlots((prev) =>
            prev.map((s) =>
                s.id === slotId ? { ...s, uploaded: true, fileName: file.name } : s
            )
        );
        setUploading(null);
    };

    const totalRequired = slots.filter((s) => s.required).length;
    const uploadedRequired = slots.filter((s) => s.required && s.uploaded).length;

    if (!loteAtual) {
        return (
            <div className="panel">
                <div className="panel-empty">
                    <Upload size={24} />
                    <p>Selecione um lote para enviar documentos</p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>📎 Documentos</h3>
            </div>

            <div className="panel-progress">
                <div className="panel-progress-bar">
                    <div
                        className="panel-progress-fill"
                        style={{ width: `${(uploadedRequired / totalRequired) * 100}%` }}
                    />
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
                                    ? <><File size={12} /> Substituir</>
                                    : <><Upload size={12} /> Enviar</>}
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
}
