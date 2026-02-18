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
import { wktToRings, calculateAreaM2, calculatePerimeterM } from '../../lib/geo-utils';

export default function DesenharPanel() {
    console.log('--- DesenharPanel v2 Mount ---');
    const { loteAtual, handleGeometryChange, mapGeometries } = useApp();
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const [geoInfo, setGeoInfo] = useState<{ area: number; perimetro: number; vertices: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sincronizar info da geometria vinda do App (mapa ou upload)
    useEffect(() => {
        // Encontra a geometria do lote atual se existir, ou a geometria de desenho ativa
        const drawing = loteAtual
            ? mapGeometries.find(g => g.id === loteAtual.id)
            : mapGeometries.find(g => g.id === 0); // Polígono temporário sendo desenhado

        if (drawing?.wkt) {
            const rings = wktToRings(drawing.wkt);
            if (rings && rings[0]) {
                setGeoInfo({
                    area: calculateAreaM2(rings[0]),
                    perimetro: calculatePerimeterM(rings[0]),
                    vertices: rings[0].length - 1,
                });
            }
        } else {
            setGeoInfo(null);
        }
    }, [mapGeometries, loteAtual]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadResult(null);

        try {
            const wkt = await parseGeoFile(file);
            if (!wkt) {
                setUploadResult({ ok: false, msg: `Não foi possível extrair geometria de "${file.name}".` });
                return;
            }

            // Calcular métricas
            const rings = wktToRings(wkt);
            if (rings && rings[0]) {
                setGeoInfo({
                    area: calculateAreaM2(rings[0]),
                    perimetro: calculatePerimeterM(rings[0]),
                    vertices: rings[0].length - 1, // exclui ponto de fechamento
                });
            }

            // Enviar para API se tiver lote selecionado
            if (loteAtual) {
                const res = await apiClient.updateLoteGeometria(loteAtual.id, wkt);
                if (res.error) {
                    setUploadResult({ ok: false, msg: res.error });
                    return;
                }
            }

            // Atualizar mapa
            handleGeometryChange(wkt);
            setUploadResult({ ok: true, msg: `Geometria importada de "${file.name}" com sucesso!` });
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
                <h3>✏️ Desenhar Lote (v2)</h3>
            </div>

            <div className="panel-section">
                <h4><Pencil size={14} /> Desenho no Mapa</h4>
                <div className="panel-info">
                    {loteAtual
                        ? 'O widget de desenho está ativo no mapa à direita. Use as ferramentas para ajustar o polígono.'
                        : 'Para começar, use as ferramentas de desenho no mapa à direita para delimitar sua área.'}
                </div>
                <ol className="panel-instructions">
                    <li>Clique no mapa para adicionar vértices</li>
                    <li>Duplo-clique para fechar o polígono</li>
                    <li>Arraste vértices para ajustar</li>
                    <li>O progresso é salvo automaticamente</li>
                </ol>
            </div>

            {/* Upload de arquivo */}
            <div className="panel-section">
                <h4><FileUp size={14} /> Importar Arquivo</h4>
                <div className="panel-info">
                    Ou se preferir, importe um arquivo:
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".kml,.kmz,.geojson,.json,.dxf"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                />
                <button
                    className="panel-btn panel-btn--primary panel-btn--full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{ marginTop: 8 }}
                >
                    <Upload size={14} />
                    {uploading ? 'Processando...' : 'Importar Arquivo'}
                </button>
            </div>

            {/* Resultado do upload */}
            {uploadResult && (
                <div className={uploadResult.ok ? 'panel-success' : 'panel-error'}>
                    {uploadResult.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {' '}{uploadResult.msg}
                </div>
            )}

            {/* Info da geometria (baseado no que está no mapa) */}
            {geoInfo && (
                <div className="panel-section">
                    <h4><MapPin size={14} /> Dados da Área</h4>
                    <div className="panel-metrics">
                        <div className="panel-metric">
                            <span className="panel-metric-label">Área</span>
                            <span className="panel-metric-value">{geoInfo.area.toFixed(1)} m²</span>
                        </div>
                        <div className="panel-metric">
                            <span className="panel-metric-label">Área (ha)</span>
                            <span className="panel-metric-value">{(geoInfo.area / 10000).toFixed(4)} ha</span>
                        </div>
                        <div className="panel-metric">
                            <span className="panel-metric-label">Perímetro</span>
                            <span className="panel-metric-value">{geoInfo.perimetro.toFixed(1)} m</span>
                        </div>
                        <div className="panel-metric">
                            <span className="panel-metric-label">Vértices</span>
                            <span className="panel-metric-value">{geoInfo.vertices}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
