/**
 * useToolShortcuts — Atalhos de teclado para ferramentas CAD
 * Numeros 1-5 mudam categoria, letras ativam ferramentas, Escape desativa
 */

import { useEffect, useCallback } from 'react';
import type { ToolCategory, ToolId, TOOL_DEFINITIONS } from '../types/tools';

const CATEGORY_KEYS: Record<string, ToolCategory> = {
  '1': 'medicao',
  '2': 'edicao',
  '3': 'topologia',
  '4': 'import-export',
  '5': 'sigef',
};

const TOOL_SHORTCUTS: Record<string, Partial<Record<ToolCategory, ToolId>>> = {
  a: { medicao: 'area' },
  p: { medicao: 'perimetro', sigef: 'adicionar-ponto' },
  g: { medicao: 'angulo' },
  z: { medicao: 'azimute' },
  c: { medicao: 'coordenadas', sigef: 'converter-coords' },
  b: { edicao: 'buffer' },
  d: { edicao: 'dividir' },
  u: { edicao: 'unir' },
  s: { edicao: 'simplificar' },
  v: { topologia: 'validar-topologia', sigef: 'sigef-validar' },
  f: { topologia: 'fechar-gaps' },
  t: { topologia: 'simplificar-topologia' },
  k: { 'import-export': 'importar-kml' },
  j: { 'import-export': 'importar-geojson' },
  e: { 'import-export': 'exportar-geojson' },
  x: { 'import-export': 'exportar-dxf' },
  m: { sigef: 'sigef-memorial' },
  r: { sigef: 'sigef-vertices' },
};

interface UseToolShortcutsOptions {
  activeCategory: ToolCategory;
  activeTool: ToolId | null;
  onCategoryChange: (category: ToolCategory) => void;
  onToolActivate: (tool: ToolId | null) => void;
  enabled?: boolean;
}

export default function useToolShortcuts({
  activeCategory,
  activeTool,
  onCategoryChange,
  onToolActivate,
  enabled = true,
}: UseToolShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      // Escape: deactivate
      if (key === 'escape') {
        event.preventDefault();
        onToolActivate(null);
        return;
      }

      // Number keys: switch category
      if (CATEGORY_KEYS[key] && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onCategoryChange(CATEGORY_KEYS[key]);
        return;
      }

      // Letter keys: activate tool based on category
      if (TOOL_SHORTCUTS[key] && !event.ctrlKey && !event.altKey) {
        const toolForCategory = TOOL_SHORTCUTS[key][activeCategory];
        if (toolForCategory) {
          event.preventDefault();
          if (activeTool === toolForCategory) {
            onToolActivate(null);
          } else {
            onToolActivate(toolForCategory);
          }
        }
      }
    },
    [enabled, activeCategory, activeTool, onCategoryChange, onToolActivate]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
