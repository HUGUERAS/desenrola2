/**
 * ToolCategoryTabs — Abas de categorias de ferramentas
 * 5 categorias: Medicao, Edicao, Topologia, Import/Export, SIGEF
 */
import { Ruler, PenTool, GitBranch, FileUp, Shield } from 'lucide-react';
import type { ToolCategory } from '../../types/tools';
import { CATEGORY_CONFIG } from '../../types/tools';

const CATEGORY_ICONS: Record<ToolCategory, any> = {
  medicao: Ruler,
  edicao: PenTool,
  topologia: GitBranch,
  'import-export': FileUp,
  sigef: Shield,
};

interface ToolCategoryTabsProps {
  category: ToolCategory;
  onCategoryChange: (category: ToolCategory) => void;
}

export default function ToolCategoryTabs({ category, onCategoryChange }: ToolCategoryTabsProps) {
  return (
    <div className="tool-category-tabs">
      {CATEGORY_CONFIG.map((cat) => {
        const IconComp = CATEGORY_ICONS[cat.id];
        return (
          <button
            key={cat.id}
            className={`tool-category-tab ${category === cat.id ? 'active' : ''}`}
            onClick={() => onCategoryChange(cat.id)}
            title={cat.label}
          >
            <IconComp size={14} />
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}
