/**
 * DesenharPanel - Hub unico de desenho, CAD e camadas
 */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    Upload,
    Pencil,
    FileUp,
    AlertCircle,
    CheckCircle,
    MapPin,
    Pentagon,
    Square,
    Circle,
    Star,
    Wrench,
    Layers,
    Eye,
    EyeOff,
    X,
    CheckCircle2,
    Trash2,
} from 'lucide-react';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { parseGeoFile } from '../../lib/file-parsers';
import { calculateAreaM2, calculatePerimeterM, geoJSONToRings } from '../../lib/geo-utils';
import ToolCategoryTabs from '../tools/ToolCategoryTabs';
import ToolButton from '../tools/ToolButton';
import useToolShortcuts from '../../hooks/useToolShortcuts';
import { TOOL_DEFINITIONS } from '../../types/tools';
import type { LayerConfig, ToolCategory, ToolId, ToolResult } from '../../types/tools';
import '../../styles/tools.css';

type DrawTool = 'polygon' | 'rectangle' | 'circle';
type EditorTab = 'desenho' | 'cad' | 'camadas';
type FavoriteAction = `draw:${DrawTool}` | `cad:${ToolId}`;

const FAVORITES_STORAGE_KEY = 'desenrola:editor-favorites:v1';
const DEFAULT_FAVORITES: FavoriteAction[] = ['draw:polygon', 'cad:area', 'cad:validar-topologia'];

function isFavoriteAction(value: string): value is FavoriteAction {
    return value.startsWith('draw:') || value.startsWith('cad:');
}

function loadFavorites(): FavoriteAction[] {
    if (typeof window === 'undefined') return DEFAULT_FAVORITES;
    try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (!raw) return DEFAULT_FAVORITES;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return DEFAULT_FAVORITES;
        const valid = parsed.filter((v): v is FavoriteAction => typeof v === 'string' && isFavoriteAction(v));
        if (valid.length !== 3) return DEFAULT_FAVORITES;
        return valid;
    } catch {
        return DEFAULT_FAVORITES;
    }
}

export default function DesenharPanel() {
    const {
        loteAtual,
        handleMapDrawingChange,
        handleSaveDrawing,
        mapGeometries,
        setSketchTool,
        activeTool,
        setActiveTool,
        activeToolCategory,
        setActiveToolCategory,
        toolResult,
        setToolResult,
        toolLayers,
        updateToolLayer,
        removeToolLayer,
    } = useApp();

    const [tab, setTab] = useState<EditorTab>('desenho');
    const [favorites, setFavorites] = useState<FavoriteAction[]>(() => loadFavorites());

    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const [geoInfo, setGeoInfo] = useState<{ area: number; perimetro: number; vertices: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [pendingGeojson, setPendingGeojson] = useState<Record<string, any> | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    }, [favorites]);

    useToolShortcuts({
        activeCategory: activeToolCategory,
        activeTool,
        onCategoryChange: setActiveToolCategory,
        onToolActivate: (tool) => {
            setActiveTool(tool);
            if (tool) setToolResult(null);
        },
        enabled: tab === 'cad',
    });

    const favoriteOptions = useMemo(() => {
        const drawOptions = [
            { value: 'draw:polygon', label: 'Poligono (vertices)' },
            { value: 'draw:rectangle', label: 'Retangulo' },
            { value: 'draw:circle', label: 'Circulo' },
        ] as Array<{ value: FavoriteAction; label: string }>;

        const cadOptions = Object.values(TOOL_DEFINITIONS)
            .flat()
            .map((tool) => ({ value: `cad:${tool.id}` as FavoriteAction, label: `CAD: ${tool.label}` }));

        return [...drawOptions, ...cadOptions];
    }, []);

    const tools = TOOL_DEFINITIONS[activeToolCategory] || [];
    const baseLayers = toolLayers.filter((l) => l.type === 'base');
    const toolLayersList = toolLayers.filter((l) => l.type === 'tool');
    const importLayers = toolLayers.filter((l) => l.type === 'import');

    const executeFavorite = useCallback((action: FavoriteAction) => {
        if (action.startsWith('draw:')) {
            const drawTool = action.replace('draw:', '') as DrawTool;
            setTab('desenho');
            setActiveTool(null);
            setSketchTool(drawTool);
            return;
        }

        const cadTool = action.replace('cad:', '') as ToolId;
        setTab('cad');
        setActiveTool(cadTool);
        setToolResult(null);
    }, [setActiveTool, setSketchTool, setToolResult]);

    const updateFavorite = (index: number, value: FavoriteAction) => {
        setFavorites((prev) => prev.map((item, i) => (i === index ? value : item)));
    };

    useEffect(() => {
        const drawing = loteAtual
            ? mapGeometries.find((g) => g.id === loteAtual.id)
            : mapGeometries.find((g) => g.id === 0);

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

    const handleSave = async () => {
        if (!pendingGeojson) return;
        setSaving(true);
        setUploadResult(null);
        try {
            const res = await handleSaveDrawing(pendingGeojson);
            if (res.ok) {
                setUploadResult({ ok: true, msg: 'Area salva com sucesso.' });
            }
        } catch (err) {
            console.error('Erro ao salvar desenho:', err);
            setUploadResult({ ok: false, msg: 'Erro ao salvar area. Verifique sua conexao.' });
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
                setUploadResult({ ok: false, msg: `Nao foi possivel extrair geometria de "${file.name}".` });
                return;
            }

            const rings = geoJSONToRings(geojson);
            if (rings && rings[0]) {
                setGeoInfo({
                    area: calculateAreaM2(rings[0]),
                    perimetro: calculatePerimeterM(rings[0]),
                    vertices: rings[0].length - 1,
                });
            }

            if (loteAtual) {
                const res = await apiClient.updateLoteGeometria(loteAtual.id, geojson);
                if (res.error) {
                    setUploadResult({ ok: false, msg: res.error });
                    return;
                }
            }

            handleMapDrawingChange(geojson);
            setUploadResult({ ok: true, msg: `Arquivo "${file.name}" importado com sucesso.` });
        } catch {
            setUploadResult({ ok: false, msg: 'Erro ao processar arquivo.' });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleCadToolClick = (toolId: ToolId) => {
        if (activeTool === toolId) {
            setActiveTool(null);
            return;
        }
        setActiveTool(toolId);
        setToolResult(null);
    };

    const toggleVisibility = (layer: LayerConfig) => {
        updateToolLayer({ ...layer, visible: !layer.visible });
    };

    const changeOpacity = (layer: LayerConfig, opacity: number) => {
        updateToolLayer({ ...layer, opacity });
    };

    const showAllLayers = () => {
        toolLayers.forEach((layer) => updateToolLayer({ ...layer, visible: true }));
    };

    const hideAllLayers = () => {
        toolLayers.forEach((layer) => updateToolLayer({ ...layer, visible: false }));
    };

    return (
        <div className="panel panel-draw-shell">
            <div className="panel-header">
                <h3>Editor do Projeto</h3>
            </div>

            <div className="panel-form">
                <div className="panel-section panel-section--no-margin-top">
                    <h4><Star size={14} /> Atalhos Rapidos (3 favoritos)</h4>
                    <div className="panel-tools-grid panel-favorites-grid">
                        {favorites.map((fav, index) => (
                            <div key={`favorite-${index}`} className="panel-favorite-slot">
                                <select
                                    className="panel-input"
                                    value={fav}
                                    onChange={(e) => updateFavorite(index, e.target.value as FavoriteAction)}
                                >
                                    {favoriteOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    className="panel-btn panel-btn--primary panel-btn--full"
                                    onClick={() => executeFavorite(fav)}
                                >
                                    Usar
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="panel-tabs">
                    <button
                        className={`panel-tab ${tab === 'desenho' ? 'active' : ''}`}
                        onClick={() => setTab('desenho')}
                    >
                        <Pencil size={12} /> Desenho
                    </button>
                    <button
                        className={`panel-tab ${tab === 'cad' ? 'active' : ''}`}
                        onClick={() => setTab('cad')}
                    >
                        <Wrench size={12} /> CAD
                    </button>
                    <button
                        className={`panel-tab ${tab === 'camadas' ? 'active' : ''}`}
                        onClick={() => setTab('camadas')}
                    >
                        <Layers size={12} /> Camadas
                    </button>
                </div>
            </div>

            {tab === 'desenho' && (
                <>
                    <div className="panel-section">
                        <h4><Pencil size={14} /> Ferramentas de Desenho</h4>
                        <button
                            className="panel-btn panel-btn--primary panel-btn--full"
                            onClick={() => {
                                setActiveTool(null);
                                setSketchTool('polygon');
                            }}
                            title="Desenhar poligono por vertices"
                        >
                            <Pentagon size={16} />
                            <span style={{ marginLeft: 6 }}>Desenhar polígono</span>
                        </button>
                        <button
                            className="panel-btn panel-btn--danger panel-btn--full"
                            onClick={() => setSketchTool('clear')}
                            title="Apagar o desenho atual do mapa"
                            style={{ marginTop: 6 }}
                        >
                            <Trash2 size={16} />
                            <span style={{ marginLeft: 6 }}>Limpar desenho</span>
                        </button>
                        <div className="panel-info">
                            Clique no mapa para inserir vértices. Duplo-clique para fechar o polígono.
                        </div>
                    </div>

                    <div className="panel-section panel-draw-confirm">
                        <div className="panel-draw-confirm-head">
                            <CheckCircle size={20} />
                            <span className="panel-draw-confirm-title">Area detectada no mapa</span>
                        </div>
                        <button
                            className="panel-btn panel-btn--primary panel-btn--full panel-draw-save-btn"
                            onClick={handleSave}
                            disabled={saving || !pendingGeojson}
                        >
                            {saving ? 'SALVANDO...' : pendingGeojson ? 'CONFIRMAR E SALVAR AREA' : 'DESENHE PARA SALVAR'}
                        </button>
                        {!loteAtual && (
                            <p className="panel-draw-note">
                                Isso criara seu projeto e salvara as coordenadas.
                            </p>
                        )}
                        {!pendingGeojson && (
                            <p className="panel-draw-note" style={{ marginTop: 6 }}>
                                Desenhe ou importe um poligono para habilitar o salvamento.
                            </p>
                        )}
                    </div>

                    <div className="panel-section">
                        <h4><FileUp size={14} /> Importar Arquivo</h4>
                        <div className="panel-info">
                            Envie KML, DXF ou GeoJSON para carregar desenho.
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".kml,.kmz,.geojson,.json,.dxf"
                            onChange={handleFileUpload}
                            hidden
                        />
                        <button
                            className="panel-btn panel-btn--full panel-file-trigger"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            <Upload size={14} />
                            {uploading ? 'Processando...' : 'Selecionar Arquivo'}
                        </button>
                    </div>

                    {uploadResult && (
                        <div className={`${uploadResult.ok ? 'panel-success' : 'panel-error'} panel-upload-feedback`}>
                            {uploadResult.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            {' '}<b>{uploadResult.ok ? 'Sucesso: ' : 'Erro: '}</b>{uploadResult.msg}
                        </div>
                    )}

                    {geoInfo && (
                        <div className="panel-section panel-section--spaced">
                            <h4><MapPin size={14} /> Medicoes da Area</h4>
                            <div className="panel-metrics">
                                <div className="panel-metric">
                                    <span className="panel-metric-label">Area Bruta</span>
                                    <span className="panel-metric-value">{geoInfo.area.toFixed(1)} m2</span>
                                </div>
                                <div className="panel-metric">
                                    <span className="panel-metric-label">Area (Hectares)</span>
                                    <span className="panel-metric-value">{(geoInfo.area / 10000).toFixed(4)} ha</span>
                                </div>
                                <div className="panel-metric">
                                    <span className="panel-metric-label">Perimetro</span>
                                    <span className="panel-metric-value">{geoInfo.perimetro.toFixed(1)} m</span>
                                </div>
                                <div className="panel-metric">
                                    <span className="panel-metric-label">Pontos (Vertices)</span>
                                    <span className="panel-metric-value">{geoInfo.vertices}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {tab === 'cad' && (
                <>
                    <ToolCategoryTabs
                        category={activeToolCategory}
                        onCategoryChange={(category: ToolCategory) => {
                            setActiveToolCategory(category);
                            setActiveTool(null);
                            setToolResult(null);
                        }}
                    />

                    <div className="tool-grid">
                        {tools.map((tool) => (
                            <ToolButton
                                key={tool.id}
                                id={tool.id}
                                label={tool.label}
                                icon={tool.icon}
                                description={tool.description}
                                shortcut={tool.shortcut}
                                active={activeTool === tool.id}
                                onClick={() => handleCadToolClick(tool.id)}
                            />
                        ))}
                    </div>

                    {activeTool && (
                        <div className="tool-active-bar">
                            <span className="tool-active-dot" />
                            <span className="tool-active-label">
                                {tools.find((tool) => tool.id === activeTool)?.label || activeTool}
                            </span>
                            <button className="tool-cancel-btn" onClick={() => setActiveTool(null)} title="Cancelar (Esc)">
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {toolResult && (
                        <ToolResultBox result={toolResult} />
                    )}

                    {!activeTool && !toolResult && (
                        <div className="tool-empty-hint">
                            Selecione uma ferramenta CAD.
                        </div>
                    )}
                </>
            )}

            {tab === 'camadas' && (
                <>
                    <div className="camadas-actions">
                        <button className="camadas-action-btn" onClick={showAllLayers} title="Mostrar todas">
                            <Eye size={14} /> Mostrar Todas
                        </button>
                        <button className="camadas-action-btn" onClick={hideAllLayers} title="Ocultar todas">
                            <EyeOff size={14} /> Ocultar Todas
                        </button>
                    </div>

                    {baseLayers.length > 0 && (
                        <div className="camadas-group">
                            <div className="camadas-group-title">Camadas Base</div>
                            {baseLayers.map((layer) => (
                                <LayerItem
                                    key={layer.id}
                                    layer={layer}
                                    onToggle={() => toggleVisibility(layer)}
                                    onOpacityChange={(value) => changeOpacity(layer, value)}
                                />
                            ))}
                        </div>
                    )}

                    {toolLayersList.length > 0 && (
                        <div className="camadas-group">
                            <div className="camadas-group-title">Ferramentas</div>
                            {toolLayersList.map((layer) => (
                                <LayerItem
                                    key={layer.id}
                                    layer={layer}
                                    onToggle={() => toggleVisibility(layer)}
                                    onOpacityChange={(value) => changeOpacity(layer, value)}
                                    onRemove={layer.removable !== false ? () => removeToolLayer(layer.id) : undefined}
                                />
                            ))}
                        </div>
                    )}

                    {importLayers.length > 0 && (
                        <div className="camadas-group">
                            <div className="camadas-group-title">Importados</div>
                            {importLayers.map((layer) => (
                                <LayerItem
                                    key={layer.id}
                                    layer={layer}
                                    onToggle={() => toggleVisibility(layer)}
                                    onOpacityChange={(value) => changeOpacity(layer, value)}
                                    onRemove={() => removeToolLayer(layer.id)}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function ToolResultBox({ result }: { result: ToolResult }) {
    return (
        <div className="tool-result">
            <div className="tool-result-header">
                <CheckCircle2 size={14} />
                <span className="tool-result-type">{result.type}</span>
            </div>
            <div className="tool-result-value">
                {typeof result.value === 'number'
                    ? formatNumber(result.value, result.unit)
                    : result.value}
            </div>
        </div>
    );
}

function formatNumber(value: number, unit?: string): string {
    if (unit === 'm2') {
        const ha = value / 10000;
        return `${value.toFixed(2)} m2 (${ha.toFixed(4)} ha)`;
    }
    if (unit === 'm') {
        return `${value.toFixed(2)} m (${(value / 1000).toFixed(4)} km)`;
    }
    if (unit === 'graus') {
        return `${value.toFixed(4)} graus`;
    }
    return value.toFixed(4);
}

function LayerItem({
    layer,
    onToggle,
    onOpacityChange,
    onRemove,
}: {
    layer: LayerConfig;
    onToggle: () => void;
    onOpacityChange: (value: number) => void;
    onRemove?: () => void;
}) {
    return (
        <div className={`camada-item ${!layer.visible ? 'camada-hidden' : ''}`}>
            <div className="camada-row">
                <button className="camada-toggle" onClick={onToggle} title={layer.visible ? 'Ocultar' : 'Mostrar'}>
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <span className="camada-title">{layer.title}</span>
                {onRemove && (
                    <button className="camada-remove" onClick={onRemove} title="Remover camada">
                        <X size={12} />
                    </button>
                )}
            </div>
            <div className="camada-opacity">
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={layer.opacity}
                    onChange={(e) => onOpacityChange(Number(e.target.value))}
                    className="camada-slider"
                />
                <span className="camada-opacity-value">{layer.opacity}%</span>
            </div>
        </div>
    );
}
