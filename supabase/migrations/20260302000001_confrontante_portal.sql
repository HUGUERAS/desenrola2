-- =============================================
-- Portal do confrontante: campos e políticas
-- =============================================

-- Extensão para gen_random_uuid (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Novos campos em confrontacoes
ALTER TABLE confrontacoes
  ADD COLUMN IF NOT EXISTS token_acesso UUID UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'identified_no_contact',
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS data_contato TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_docs_recebidos TIMESTAMPTZ;

-- Novo vínculo opcional do documento com confrontante
ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS confrontante_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documentos_confrontante_id_fkey'
  ) THEN
    ALTER TABLE documentos
      ADD CONSTRAINT documentos_confrontante_id_fkey
      FOREIGN KEY (confrontante_id)
      REFERENCES confrontacoes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Policies do portal anon via token
ALTER TABLE confrontacoes ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para obter token da requisição
CREATE OR REPLACE FUNCTION get_confrontante_token()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'confrontante_token', '')::UUID;
$$;

CREATE POLICY "confrontacoes: anon select por token" ON confrontacoes
  FOR SELECT
  TO anon
  USING (
    token_acesso IS NOT NULL
    AND token_acesso = get_confrontante_token()
  );

CREATE POLICY "confrontacoes: anon update por token" ON confrontacoes
  FOR UPDATE
  TO anon
  USING (
    token_acesso IS NOT NULL
    AND token_acesso = get_confrontante_token()
  )
  WITH CHECK (
    token_acesso IS NOT NULL
    AND token_acesso = get_confrontante_token()
  );

-- Documentos vinculados a confrontações acessíveis por token
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos: anon select por token confrontante" ON documentos
  FOR SELECT
  TO anon
  USING (
    confrontante_id IN (
      SELECT c.id
      FROM confrontacoes c
      WHERE c.token_acesso IS NOT NULL
        AND c.token_acesso = get_confrontante_token()
    )
  );

CREATE POLICY "documentos: anon insert por token confrontante" ON documentos
  FOR INSERT
  TO anon
  WITH CHECK (
    confrontante_id IN (
      SELECT c.id
      FROM confrontacoes c
      WHERE c.token_acesso IS NOT NULL
        AND c.token_acesso = get_confrontante_token()
    )
  );
