/**
 * ToolButton — Botao individual de ferramenta CAD
 */
import {
  Ruler, PenTool, Scissors, Circle, GitMerge, Minimize2, CheckCircle, GitBranch, Zap,
  FileUp, FileDown, FileCog, FileJson, Shield, ShieldCheck, FileText, MapPin,
  Repeat, PlusCircle, Square, Triangle, Compass, Crosshair
} from 'lucide-react';

const TOOL_ICONS: Record<string, any> = {
  ruler: Ruler, 'pen-tool': PenTool, scissors: Scissors, circle: Circle,
  merge: GitMerge, 'minimize-2': Minimize2, 'check-circle': CheckCircle,
  'git-branch': GitBranch, 'git-merge': GitMerge, zap: Zap,
  'file-up': FileUp, 'file-down': FileDown, 'file-cog': FileCog, 'file-json': FileJson,
  shield: Shield, 'shield-check': ShieldCheck, 'file-text': FileText, 'map-pin': MapPin,
  repeat: Repeat, 'plus-circle': PlusCircle, square: Square, triangle: Triangle,
  compass: Compass, crosshair: Crosshair,
};

interface ToolButtonProps {
  id: string;
  label: string;
  icon: string;
  description: string;
  shortcut?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export default function ToolButton({
  id,
  label,
  icon,
  description,
  shortcut,
  active,
  disabled = false,
  onClick,
}: ToolButtonProps) {
  const IconComponent = TOOL_ICONS[icon] || Square;

  return (
    <button
      className={`tool-button ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      title={`${description}${shortcut ? ` (${shortcut})` : ''}`}
      disabled={disabled}
      onClick={onClick}
      data-tool-id={id}
      aria-label={description}
      aria-pressed={active}
    >
      <IconComponent size={16} />
      <span className="tool-label">{label}</span>
      {shortcut && <kbd className="tool-shortcut">{shortcut}</kbd>}
    </button>
  );
}
