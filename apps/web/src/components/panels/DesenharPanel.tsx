/**
 * DesenharPanel — Ferramentas de desenho e upload de arquivos geoespaciais
 * O desenho real acontece no MapContainer via Sketch widget.
 * Este painel controla: instruções, upload de arquivos, informações do lote.
 */
import { useState, useRef, useEffect } from 'react';
import { Upload, Pencil, FileUp, AlertCircle, CheckCircle, MapPin } from 'lucide-react';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { parseGeoFile } from '../../lib/file-parsers';
import { wktToRings, calculateAreaM2, calculatePerimeterM, geoJSONToRings } from '../../lib/geo-utils';

interface Lote {
    id: number;
    geom?: string;
    geojson?: Record<string, any>;
    nome_cliente?: string;
}

export default function DesenharPanel() {
    console.log('--- DesenharPanel Mount ---');
    const { loteAtual, handleMapDrawingChange, handleSaveDrawing, mapGeometries } = useApp();

    // Estados para Upload e Geometria
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const [geoInfo, setGeoInfo] = useState<{ area: number; perimetro: number; vertices: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estados para Salvamento Manual
    const [pendingGeojson, setPendingGeojson] = useState<Record<string, any> | null>(null);
    const [saving, setSaving] = useState(false);

    // Sincronizar info da geometria vinda do App (mapa ou upload)
    useEffect(() => {
        // Encontra a geometria do lote atual se existir, ou a geometria de desenho ativa (id=0)
        const drawing = loteAtual
            ? mapGeometries.find(g => g.id === loteAtual.id)
            : mapGeometries.find(g => g.id === 0);

        if (drawing?.geojson) {
            setPendingGeojson(drawing.geojson);
            const rings = geoJSONToRings(drawing.geojson);
            if (rings && rings[0]) {
                setGeoInfo({
                    area: calculateAreaM2(rings[0]),
                    perimetro: calculatePerimeterM(rings[0]),
                    vertices: rings[0].length - 1,
                });
            }
        } else {
            setGeoInfo(null);
            setPendingGeojson(null);
        }
    }, [mapGeometries, loteAtual]);

    // Função para salvar manualmente (o que o usuário pediu)
    const handleSave = async () => {
        if (!pendingGeojson) return;
        setSaving(true);
        setUploadResult(null);
        try {
            const res = await handleSaveDrawing(pendingGeojson);
            if (res.ok) {
                setUploadResult({ ok: true, msg: 'Área salva com sucesso!' });
            }
        } catch (err) {
            console.error('Erro ao salvar desenho:', err);
            setUploadResult({ ok: false, msg: 'Erro ao salvar área. Verifique sua conexão.' });
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadResult(null);

        try {
            const geojson = await parseGeoFile(file);
            if (!geojson) {
                setUploadResult({ ok: false, msg: `Não foi possível extrair geometria de "${file.name}".` });
                return;
            }

            // Calcular métricas localmente para feedback imediato
            const rings = geoJSONToRings(geojson);
            if (rings && rings[0]) {
                setGeoInfo({
                    area: calculateAreaM2(rings[0]),
                    perimetro: calculatePerimeterM(rings[0]),
                    vertices: rings[0].length - 1,
                });
            }

            // Se já tiver um lote selecionado, atualiza ele na API
            if (loteAtual) {
                const res = await apiClient.updateLoteGeometria(loteAtual.id, geojson);
                if (res.error) {
                    setUploadResult({ ok: false, msg: res.error });
                    return;
                }
            }

            // Avisa o App Shell sobre a nova geometria
            handleMapDrawingChange(geojson);
            setUploadResult({ ok: true, msg: `Arquivo "${file.name}" importado com sucesso!` });
        } catch (err) {
            setUploadResult({ ok: false, msg: 'Erro ao processar arquivo.' });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="panel" style={{ borderTop: '4px solid #3b82f6' }}>
            <div className="panel-header">
                <h3>✏️ Desenhar Lote</h3>
            </div>

            <div className="panel-section">
                <h4><Pencil size={14} /> Desenho no Mapa</h4>
                <div className="panel-info">
                    {loteAtual
                        ? 'Você já possui uma área salva. Use as ferramentas no mapa para ajustá-la e clique em salvar para atualizar.'
                        : 'Use as ferramentas de Polígono no canto superior direito do mapa para delimitar sua área.'}
                </div>
                {!loteAtual && (
                    <ol className="panel-instructions">
                        <li>Selecione o ícone de polígono no mapa</li>
                        <li>Clique nos pontos para contornar a área</li>
                        <li>Duplo-clique para fechar o desenho</li>
                    </ol>
                )}
            </div>

            {/* BOTÃO DE SALVAR - FEEDBACK VISUAL PARA O USUÁRIO */}
            {geoInfo && (
                <div className="panel-section" style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '12px', border: '1px solid #bae6fd', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#0369a1' }}>
                        <CheckCircle size={20} />
                        <span style={{ fontWeight: 600 }}>Área detectada no mapa</span>
                    </div>

                    <button
                        className="panel-btn panel-btn--primary panel-btn--full"
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            height: '52px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            backgroundColor: '#2563eb',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        {saving ? 'SALVANDO...' : 'CONFIRMAR E SALVAR ÁREA'}
                    </button>
                    {!loteAtual && (
                        <p style={{ fontSize: '0.75rem', marginTop: '8px', color: '#64748b', textAlign: 'center' }}>
                            Isso criará seu projeto e salvará as coordenadas.
                        </p>
                    )}
                </div>
            )}

            {/* Importar arquivo */}
            <div className="panel-section">
                <h4><FileUp size={14} /> Importar Arquivo</h4>
                <div className="panel-info">
                    Ou se preferir, envie um arquivo (KML, DXF ou GeoJSON):
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".kml,.kmz,.geojson,.json,.dxf"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                />
                <button
                    className="panel-btn panel-btn--full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{ marginTop: 8, border: '1px dashed #cbd5e1', color: '#64748b' }}
                >
                    <Upload size={14} />
                    {uploading ? 'Processando...' : 'Selecionar Arquivo'}
                </button>
            </div>

            {/* Resultado do upload/save */}
            {uploadResult && (
                <div className={uploadResult.ok ? 'panel-success' : 'panel-error'} style={{ padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
                    {uploadResult.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {' '}<b>{uploadResult.ok ? 'Sucesso: ' : 'Erro: '}</b>{uploadResult.msg}
                </div>
            )}

            {/* Info da geometria */}
            {geoInfo && (
                <div className="panel-section" style={{ marginTop: '20px' }}>
                    <h4><MapPin size={14} /> Medições da Área</h4>
                    <div className="panel-metrics">
                        <div className="panel-metric">
                            <span className="panel-metric-label">Área Bruta</span>
                            <span className="panel-metric-value">{geoInfo.area.toFixed(1)} m²</span>
                        </div>
                        <div className="panel-metric">
                            <span className="panel-metric-label">Área (Hectares)</span>
                            <span className="panel-metric-value">{(geoInfo.area / 10000).toFixed(4)} ha</span>
                        </div>
                        <div className="panel-metric">
                            <span className="panel-metric-label">Perímetro</span>
                            <span className="panel-metric-value">{geoInfo.perimetro.toFixed(1)} m</span>
                        </div>
                        <div className="panel-metric">
                            <span className="panel-metric-label">Pontos (Vértices)</span>
                            <span className="panel-metric-value">{geoInfo.vertices}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
