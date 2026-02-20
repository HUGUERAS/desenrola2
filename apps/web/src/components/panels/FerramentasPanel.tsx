/**
 * FerramentasPanel — Painel principal de ferramentas CAD
 * Abas de categorias + grid de botoes + area de resultado
 */
import { useState, useCallback } from 'react';
import { useApp } from '../../pages/AppShell';
import ToolCategoryTabs from '../tools/ToolCategoryTabs';
import ToolButton from '../tools/ToolButton';
import { TOOL_DEFINITIONS } from '../../types/tools';
import type { ToolId, ToolCategory, ToolResult } from '../../types/tools';
import useToolShortcuts from '../../hooks/useToolShortcuts';
import { X, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';
import '../../styles/tools.css';

export default function FerramentasPanel() {
  const {
    activeTool, setActiveTool,
    activeToolCategory, setActiveToolCategory,
    toolResult, setToolResult,
  } = useApp();

  const [toolInfo, setToolInfo] = useState<string | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);
  const [bufferDistance, setBufferDistance] = useState(10);

  // Keyboard shortcuts
  useToolShortcuts({
    activeCategory: activeToolCategory,
    activeTool,
    onCategoryChange: setActiveToolCategory,
    onToolActivate: (tool) => {
      setActiveTool(tool);
      setToolError(null);
      setToolInfo(null);
    },
    enabled: true,
  });

  const tools = TOOL_DEFINITIONS[activeToolCategory] || [];

  const handleToolClick = useCallback((toolId: ToolId) => {
    if (activeTool === toolId) {
      setActiveTool(null);
      setToolInfo(null);
      setToolError(null);
    } else {
      setActiveTool(toolId);
      setToolResult(null);
      setToolError(null);
    }
  }, [activeTool, setActiveTool, setToolResult]);

  const handleCancel = useCallback(() => {
    setActiveTool(null);
    setToolResult(null);
    setToolInfo(null);
    setToolError(null);
  }, [setActiveTool, setToolResult]);

  return (
    <div className="panel ferramentas-panel">
      <div className="panel-header">
        <Wrench size={18} />
        <h3>Ferramentas CAD</h3>
        <span className="panel-badge">{tools.length}</span>
      </div>

      {/* Category Tabs */}
      <ToolCategoryTabs
        category={activeToolCategory}
        onCategoryChange={(cat) => {
          setActiveToolCategory(cat);
          setActiveTool(null);
          setToolResult(null);
          setToolInfo(null);
          setToolError(null);
        }}
      />

      {/* Buffer distance input (only when buffer tool is in view) */}
      {activeToolCategory === 'edicao' && (
        <div className="tool-option">
          <label>Distancia Buffer (m):</label>
          <input
            type="number"
            value={bufferDistance}
            onChange={(e) => setBufferDistance(Number(e.target.value) || 10)}
            min={1}
            max={10000}
            step={1}
            className="tool-input"
          />
        </div>
      )}

      {/* Tool Grid */}
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
            onClick={() => handleToolClick(tool.id)}
          />
        ))}
      </div>

      {/* Active Tool Indicator */}
      {activeTool && (
        <div className="tool-active-bar">
          <span className="tool-active-dot" />
          <span className="tool-active-label">
            {tools.find(t => t.id === activeTool)?.label || activeTool}
          </span>
          <button className="tool-cancel-btn" onClick={handleCancel} title="Cancelar (Esc)">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tool Info */}
      {toolInfo && (
        <div className="tool-info-bar">
          <AlertCircle size={14} />
          <span>{toolInfo}</span>
        </div>
      )}

      {/* Tool Error */}
      {toolError && (
        <div className="tool-error-bar">
          <X size={14} />
          <span>{toolError}</span>
        </div>
      )}

      {/* Tool Result */}
      {toolResult && (
        <div className="tool-result">
          <div className="tool-result-header">
            <CheckCircle2 size={14} />
            <span className="tool-result-type">{toolResult.type}</span>
          </div>
          <div className="tool-result-value">
            {typeof toolResult.value === 'number'
              ? formatNumber(toolResult.value, toolResult.unit)
              : toolResult.value}
          </div>
          {toolResult.details && (
            <div className="tool-result-details">
              {Object.entries(toolResult.details).map(([key, val]) => {
                if (Array.isArray(val)) {
                  return (
                    <div key={key} className="tool-result-detail">
                      <span className="detail-key">{key}:</span>
                      <ul className="detail-list">
                        {val.map((item, i) => (
                          <li key={i}>{String(item)}</li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                if (typeof val === 'string' && val.includes('\n')) {
                  return (
                    <div key={key} className="tool-result-detail">
                      <span className="detail-key">{key}:</span>
                      <pre className="detail-pre">{val}</pre>
                    </div>
                  );
                }
                return (
                  <div key={key} className="tool-result-detail">
                    <span className="detail-key">{key}:</span>
                    <span className="detail-value">{String(val)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!activeTool && !toolResult && (
        <div className="tool-empty-hint">
          Selecione uma ferramenta acima para comecar.
          Use numeros 1-5 para trocar de categoria.
        </div>
      )}
    </div>
  );
}

function formatNumber(value: number, unit?: string): string {
  if (unit === 'm2') {
    const ha = value / 10000;
    return `${value.toFixed(2)} m\u00B2 (${ha.toFixed(4)} ha)`;
  }
  if (unit === 'm') {
    return `${value.toFixed(2)} m (${(value / 1000).toFixed(4)} km)`;
  }
  if (unit === 'graus') {
    return `${value.toFixed(4)}\u00B0`;
  }
  return value.toFixed(4);
}
