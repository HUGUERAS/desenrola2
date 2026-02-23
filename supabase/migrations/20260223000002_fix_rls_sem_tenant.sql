-- =============================================
-- Fix: RLS policies sem tenant_id
-- projetos não tem tenant_id — usando policies
-- baseadas em auth.uid() e email_cliente
-- =============================================

-- ─── projetos ─────────────────────────────────
DROP POLICY
IF EXISTS "projetos: acesso por tenant" ON projetos;

-- Qualquer usuário autenticado vê e gerencia projetos
-- (app de topógrafo solo / pequena equipe)
CREATE POLICY "projetos: autenticado" ON projetos
  FOR ALL
  TO authenticated
  USING
(true)
  WITH CHECK
(true);

-- ─── lotes ────────────────────────────────────
DROP POLICY
IF EXISTS "lotes: topografo do tenant" ON lotes;
DROP POLICY
IF EXISTS "lotes: proprietario por email" ON lotes;
DROP POLICY
IF EXISTS "lotes: proprietario atualiza proprio" ON lotes;

-- Topógrafo (autenticado) vê e gerencia todos os lotes
CREATE POLICY "lotes: autenticado full" ON lotes
  FOR ALL
  TO authenticated
  USING
(true)
  WITH CHECK
(true);

-- Proprietário acessa o próprio lote via email (sem conta obrigatória)
CREATE POLICY "lotes: proprietario select" ON lotes
  FOR
SELECT
    TO anon, authenticated
  USING
(email_cliente = auth.email
());

CREATE POLICY "lotes: proprietario update" ON lotes
  FOR
UPDATE
  TO anon, authenticated
  USING (email_cliente = auth.email());

-- ─── confrontacoes ────────────────────────────
DROP POLICY
IF EXISTS "confrontacoes: via lote acessível" ON confrontacoes;

CREATE POLICY "confrontacoes: autenticado" ON confrontacoes
  FOR ALL
  TO authenticated
  USING
(true)
  WITH CHECK
(true);

-- ─── orcamentos ───────────────────────────────
DROP POLICY
IF EXISTS "orcamentos: via projeto do tenant" ON orcamentos;

CREATE POLICY "orcamentos: autenticado" ON orcamentos
  FOR ALL
  TO authenticated
  USING
(true)
  WITH CHECK
(true);

-- ─── despesas ─────────────────────────────────
DROP POLICY
IF EXISTS "despesas: via projeto do tenant" ON despesas;

CREATE POLICY "despesas: autenticado" ON despesas
  FOR ALL
  TO authenticated
  USING
(true)
  WITH CHECK
(true);

-- ─── pagamentos ───────────────────────────────
DROP POLICY
IF EXISTS "pagamentos: via lote acessível" ON pagamentos;

CREATE POLICY "pagamentos: autenticado" ON pagamentos
  FOR ALL
  TO authenticated
  USING
(true)
  WITH CHECK
(true);

-- ─── documentos ───────────────────────────────
DROP POLICY
IF EXISTS "documentos: via lote acessível" ON documentos;

CREATE POLICY "documentos: autenticado" ON documentos
  FOR ALL
  TO authenticated
  USING
(true)
  WITH CHECK
(true);

-- Proprietário acessa documentos do próprio lote
CREATE POLICY "documentos: proprietario" ON documentos
  FOR
SELECT
    TO anon, authenticated
  USING
(
    lote_id::bigint IN
(
      SELECT id
FROM lotes
WHERE email_cliente = auth.email()
    )
);
