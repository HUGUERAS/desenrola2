-- =============================================================================
-- MIGRAÇÃO: Criar tabela documentos
-- Data: 2025-02
-- Objetivo: Armazenar registros de documentos gerados (memoriais, declarações, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS documentos (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id TEXT NOT NULL,
    tipo        TEXT NOT NULL,          -- 'memorial', 'declaracao', 'requerimento', etc.
    arquivo_url TEXT,
    conteudo    TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index para listagem por lote
CREATE INDEX IF NOT EXISTS idx_documentos_property_id ON documentos (property_id);

-- RLS
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

-- Topógrafos podem ver todos os documentos
CREATE POLICY "topografos_all_documentos" ON documentos
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE documentos IS 'Documentos técnicos gerados pelo sistema (memoriais, declarações, etc.)';
COMMENT ON COLUMN documentos.property_id IS 'ID do lote/propriedade (FK para properties.id)';
COMMENT ON COLUMN documentos.tipo IS 'Tipo do documento: memorial, declaracao, requerimento, etc.';
