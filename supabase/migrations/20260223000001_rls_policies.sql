-- =============================================
-- RLS Policies — Desenrola
-- Aplicar com: supabase db push
-- =============================================

-- ─── perfis ───────────────────────────────────
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfis: ver próprio" ON perfis
  FOR
SELECT USING (auth.uid() = user_id);

CREATE POLICY "perfis: editar próprio" ON perfis
  FOR ALL USING
(auth.uid
() = user_id);

-- ─── projetos ─────────────────────────────────
ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;

-- Topógrafo vê todos do seu tenant; proprietário vê os seus
CREATE POLICY "projetos: acesso por tenant" ON projetos
  FOR ALL USING
(
    tenant_id =
(
      SELECT tenant_id
FROM perfis
WHERE user_id = auth.uid()
    )
OR
    EXISTS
(
      SELECT 1
FROM lotes
WHERE lotes.projeto_id = projetos.id
    AND lotes.email_cliente = auth.email()
    )
);

-- ─── lotes ────────────────────────────────────
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;

-- Topógrafo do tenant vê todos os lotes do projeto
CREATE POLICY "lotes: topografo do tenant" ON lotes
  FOR ALL USING
(
    projeto_id IN
(
      SELECT id
FROM projetos
WHERE tenant_id = (
        SELECT tenant_id
FROM perfis
WHERE user_id = auth.uid()
      )
    )
);

-- Proprietário acessa via email (link do token)
CREATE POLICY "lotes: proprietario por email" ON lotes
  FOR
SELECT USING (email_cliente = auth.email());

CREATE POLICY "lotes: proprietario atualiza proprio" ON lotes
  FOR
UPDATE USING (email_cliente = auth.email()
);

-- ─── confrontacoes ────────────────────────────
ALTER TABLE confrontacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "confrontacoes: via lote acessível" ON confrontacoes
  FOR ALL USING
(
    lote_id IN
(
      SELECT id
FROM lotes
WHERE projeto_id IN (
        SELECT id
    FROM projetos
    WHERE tenant_id = (
          SELECT tenant_id
    FROM perfis
    WHERE user_id = auth.uid()
        )
      )
    OR email_cliente = auth.email()
    )
);

-- ─── orcamentos ───────────────────────────────
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orcamentos: via projeto do tenant" ON orcamentos
  FOR ALL USING
(
    projeto_id IN
(
      SELECT id
FROM projetos
WHERE tenant_id = (
        SELECT tenant_id
FROM perfis
WHERE user_id = auth.uid()
      )
    )
);

-- ─── despesas ─────────────────────────────────
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "despesas: via projeto do tenant" ON despesas
  FOR ALL USING
(
    projeto_id IN
(
      SELECT id
FROM projetos
WHERE tenant_id = (
        SELECT tenant_id
FROM perfis
WHERE user_id = auth.uid()
      )
    )
);

-- ─── pagamentos ───────────────────────────────
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagamentos: via lote acessível" ON pagamentos
  FOR ALL USING
(
    lote_id IN
(
      SELECT id
FROM lotes
WHERE projeto_id IN (
        SELECT id
    FROM projetos
    WHERE tenant_id = (
          SELECT tenant_id
    FROM perfis
    WHERE user_id = auth.uid()
        )
      )
    OR email_cliente = auth.email()
    )
);

-- ─── documentos ───────────────────────────────
-- lote_id é TEXT nesta tabela; lotes.id é integer — precisa de cast
-- A policy antiga "topografos_all_documentos" (USING true) é substituída por uma mais restrita

DROP POLICY
IF EXISTS "topografos_all_documentos" ON documentos;

CREATE POLICY "documentos: via lote acessível" ON documentos
  FOR ALL USING
(
    lote_id::bigint IN
(
      SELECT id
FROM lotes
WHERE projeto_id IN (
        SELECT id
    FROM projetos
    WHERE tenant_id = (
          SELECT tenant_id
    FROM perfis
    WHERE user_id = auth.uid()
        )
      )
    OR email_cliente = auth.email()
    )
);
