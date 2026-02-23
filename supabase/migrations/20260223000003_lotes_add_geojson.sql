-- Adicionar coluna geojson à tabela lotes
-- Armazena o polígono enviado pelo cliente (FeatureCollection/Feature/Polygon)
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS geojson JSONB;

-- Index GIN para consultas espaciais futuras via jsonb
CREATE INDEX IF NOT EXISTS idx_lotes_geojson ON lotes USING GIN (geojson);
