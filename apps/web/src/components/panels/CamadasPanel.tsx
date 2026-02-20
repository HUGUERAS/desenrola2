/**
 * CamadasPanel — Controle de visibilidade e opacidade das camadas do mapa
 */
import { useApp } from '../../pages/AppShell';
import type { LayerConfig } from '../../types/tools';
import { Layers, Eye, EyeOff, X, ToggleLeft, ToggleRight } from 'lucide-react';
import '../../styles/tools.css';

export default function CamadasPanel() {
  const { toolLayers, updateToolLayer, removeToolLayer } = useApp();

  const baseLayers = toolLayers.filter(l => l.type === 'base');
  const toolLayersList = toolLayers.filter(l => l.type === 'tool');
  const importLayers = toolLayers.filter(l => l.type === 'import');

  const toggleVisibility = (layer: LayerConfig) => {
    updateToolLayer({ ...layer, visible: !layer.visible });
  };

  const changeOpacity = (layer: LayerConfig, opacity: number) => {
    updateToolLayer({ ...layer, opacity });
  };

  const showAll = () => {
    toolLayers.forEach(l => updateToolLayer({ ...l, visible: true }));
  };

  const hideAll = () => {
    toolLayers.forEach(l => updateToolLayer({ ...l, visible: false }));
  };

  return (
    <div className="panel camadas-panel">
      <div className="panel-header">
        <Layers size={18} />
        <h3>Camadas</h3>
        <span className="panel-badge">{toolLayers.length}</span>
      </div>

      {/* Bulk actions */}
      <div className="camadas-actions">
        <button className="camadas-action-btn" onClick={showAll} title="Mostrar Todas">
          <Eye size={14} /> Mostrar Todas
        </button>
        <button className="camadas-action-btn" onClick={hideAll} title="Ocultar Todas">
          <EyeOff size={14} /> Ocultar Todas
        </button>
      </div>

      {/* Base Layers */}
      {baseLayers.length > 0 && (
        <div className="camadas-group">
          <div className="camadas-group-title">Camadas Base</div>
          {baseLayers.map(layer => (
            <LayerItem
              key={layer.id}
              layer={layer}
              onToggle={() => toggleVisibility(layer)}
              onOpacityChange={(val) => changeOpacity(layer, val)}
            />
          ))}
        </div>
      )}

      {/* Tool Layers */}
      {toolLayersList.length > 0 && (
        <div className="camadas-group">
          <div className="camadas-group-title">Ferramentas</div>
          {toolLayersList.map(layer => (
            <LayerItem
              key={layer.id}
              layer={layer}
              onToggle={() => toggleVisibility(layer)}
              onOpacityChange={(val) => changeOpacity(layer, val)}
              onRemove={layer.removable !== false ? () => removeToolLayer(layer.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Import Layers */}
      {importLayers.length > 0 && (
        <div className="camadas-group">
          <div className="camadas-group-title">Importados</div>
          {importLayers.map(layer => (
            <LayerItem
              key={layer.id}
              layer={layer}
              onToggle={() => toggleVisibility(layer)}
              onOpacityChange={(val) => changeOpacity(layer, val)}
              onRemove={() => removeToolLayer(layer.id)}
            />
          ))}
        </div>
      )}

      {toolLayers.length === 0 && (
        <div className="tool-empty-hint">
          Nenhuma camada disponivel.
          Desenhe ou importe geometrias para comecar.
        </div>
      )}
    </div>
  );
}

function LayerItem({
  layer,
  onToggle,
  onOpacityChange,
  onRemove,
}: {
  layer: LayerConfig;
  onToggle: () => void;
  onOpacityChange: (val: number) => void;
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
