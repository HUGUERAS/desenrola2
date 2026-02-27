import { useApp } from '../pages/AppShell';
import { TOOL_DEFINITIONS, type ToolId } from '../types/tools';
import { Info, AlertCircle } from 'lucide-react';

export default function ToolInstruction() {
  const { activeTool, activeToolCategory, toolInfo, toolError } = useApp();

  if (!activeTool) return null;

  const toolDef = TOOL_DEFINITIONS[activeToolCategory]?.find((t) => t.id === activeTool);
  const label = toolDef?.label || activeTool;
  const description = toolDef?.description || '';

  return (
    <div className="tool-instruction-overlay">
      <div className="instruction-header">
        <strong>{label}</strong>
        <span className="instruction-badge">Ativo</span>
      </div>
      
      {toolError ? (
        <div className="instruction-message error">
          <AlertCircle size={16} />
          {toolError}
        </div>
      ) : toolInfo ? (
        <div className="instruction-message info">
          <Info size={16} />
          {toolInfo}
        </div>
      ) : (
        <div className="instruction-message default">
          {description}
        </div>
      )}

      <div className="instruction-hint">
        Pressione <strong>ESC</strong> para cancelar
      </div>
    </div>
  );
}
