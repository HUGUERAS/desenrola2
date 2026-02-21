-- =============================================================================
-- MIGRACAO: Padronizar documentos com lote_id (legado: property_id)
-- Data: 2026-02
-- Objetivo: reduzir ambiguidade e manter compatibilidade com dados antigos
-- =============================================================================

ALTER TABLE documentos
ADD COLUMN IF NOT EXISTS lote_id TEXT;

-- Backfill inicial: usa property_id legado quando lote_id ainda estiver vazio
UPDATE documentos
SET lote_id = property_id
WHERE (lote_id IS NULL OR lote_id = '')
  AND property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_lote_id ON documentos (lote_id);

COMMENT ON COLUMN documentos.lote_id IS 'ID do lote (canônico). Mantido property_id legado para compatibilidade.';
