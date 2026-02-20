-- =============================================================================
-- MIGRAÇÃO: Campos para integração Carretel → Desenrola
-- Data: 2025-02
-- Objetivo: Adicionar colunas necessárias para NovoProjeto, Profile, Financeiro,
--           Confrontações e status automático (atrasado)
-- IMPORTANTE: Execute em ambiente de homologação antes de produção.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PROJETOS — NovoProjeto wizard (endereço, cidade, estado, observações)
-- -----------------------------------------------------------------------------
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'GO';
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS observacoes TEXT;

COMMENT ON COLUMN projetos.endereco IS 'Endereço completo do projeto (NovoProjeto wizard)';
COMMENT ON COLUMN projetos.cidade IS 'Município do projeto';
COMMENT ON COLUMN projetos.estado IS 'UF (2 letras)';
COMMENT ON COLUMN projetos.observacoes IS 'Observações gerais';

-- -----------------------------------------------------------------------------
-- 2. USUARIOS / PROFILES — Dados do topógrafo (CREA, empresa)
-- Nota: Se usar Supabase auth.users + profiles, adapte para a tabela correta
-- -----------------------------------------------------------------------------
-- Opção A: tabela usuarios (schema.sql)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS crea TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa TEXT;

-- Opção B: se usar profiles (Supabase) — descomente e ajuste
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crea TEXT;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS empresa TEXT;

COMMENT ON COLUMN usuarios.crea IS 'Número CREA/CFT do topógrafo';
COMMENT ON COLUMN usuarios.empresa IS 'Nome da empresa do topógrafo';

-- -----------------------------------------------------------------------------
-- 3. CONFRONTACOES — Nome do imóvel confrontante (#CONF_IMOVEL SEAPA)
-- -----------------------------------------------------------------------------
ALTER TABLE confrontacoes ADD COLUMN IF NOT EXISTS imovel TEXT;

COMMENT ON COLUMN confrontacoes.imovel IS 'Nome do imóvel do confrontante (doc 03 SEAPA)';

-- -----------------------------------------------------------------------------
-- 4. DESPESAS — Projeto + data de vencimento (status atrasado)
-- -----------------------------------------------------------------------------
-- projeto_id: vincular despesa ao projeto (financeiro.py pode estar sem)
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS projeto_id INTEGER REFERENCES projetos(id) ON DELETE SET NULL;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_vencimento DATE;

COMMENT ON COLUMN despesas.projeto_id IS 'Projeto ao qual a despesa pertence';
COMMENT ON COLUMN despesas.data_vencimento IS 'Data de vencimento (para status atrasado)';

-- -----------------------------------------------------------------------------
-- 5. ORCAMENTOS — Data emissão, vencimento, cliente (status atrasado + FinancialManagement)
-- -----------------------------------------------------------------------------
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS data_emissao DATE DEFAULT CURRENT_DATE;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS cliente_nome TEXT;

COMMENT ON COLUMN orcamentos.data_emissao IS 'Data de emissão do orçamento';
COMMENT ON COLUMN orcamentos.data_vencimento IS 'Data de vencimento (para status atrasado)';
COMMENT ON COLUMN orcamentos.cliente_nome IS 'Nome do cliente (exibição rápida)';

-- Garantir projeto_id se não existir
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS projeto_id INTEGER REFERENCES projetos(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 6. PAGAMENTOS — Data de vencimento (status atrasado)
-- -----------------------------------------------------------------------------
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS data_vencimento DATE;

COMMENT ON COLUMN pagamentos.data_vencimento IS 'Data de vencimento (para status atrasado)';

-- -----------------------------------------------------------------------------
-- 7. LOTES — Garantir colunas usadas pela API (se schema divergir)
-- Nota: O schema.sql usa cliente_id; a API usa nome_cliente, email_cliente, etc.
-- Se sua tabela lotes já tem essas colunas, estes ALTERs falharão com "column exists".
-- Use IF NOT EXISTS onde o PostgreSQL suportar (9.6+).
-- -----------------------------------------------------------------------------
-- ALTER TABLE lotes ADD COLUMN IF NOT EXISTS nome_cliente TEXT;
-- ALTER TABLE lotes ADD COLUMN IF NOT EXISTS email_cliente TEXT;
-- ALTER TABLE lotes ADD COLUMN IF NOT EXISTS telefone_cliente TEXT;
-- ALTER TABLE lotes ADD COLUMN IF NOT EXISTS cpf_cnpj_cliente TEXT;
-- ALTER TABLE lotes ADD COLUMN IF NOT EXISTS token_acesso TEXT UNIQUE;
-- ALTER TABLE lotes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDENTE';

-- -----------------------------------------------------------------------------
-- 8. ÍNDICES (opcional, para performance)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_despesas_projeto ON despesas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_projeto ON orcamentos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos(status);

-- =============================================================================
-- FIM DA MIGRAÇÃO
-- =============================================================================
