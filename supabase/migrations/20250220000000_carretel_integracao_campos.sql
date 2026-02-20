-- =============================================================================
-- MIGRAÇÃO: Campos para integração Carretel → Desenrola
-- Data: 2025-02
-- Objetivo: Adicionar colunas necessárias para NovoProjeto, Profile, Financeiro,
--           Confrontações e status automático (atrasado)
-- =============================================================================

-- 1. PROJETOS
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'GO';
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS observacoes TEXT;

COMMENT ON COLUMN projetos.endereco IS 'Endereço completo do projeto';
COMMENT ON COLUMN projetos.cidade IS 'Município do projeto';
COMMENT ON COLUMN projetos.estado IS 'UF';
COMMENT ON COLUMN projetos.observacoes IS 'Observações gerais';

-- 2. PERFIS (usuários)
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS crea TEXT;
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS empresa TEXT;

COMMENT ON COLUMN perfis.crea IS 'Número CREA/CFT do topógrafo';
COMMENT ON COLUMN perfis.empresa IS 'Nome da empresa do topógrafo';

-- 3. CONFRONTACOES
ALTER TABLE confrontacoes ADD COLUMN IF NOT EXISTS imovel TEXT;

COMMENT ON COLUMN confrontacoes.imovel IS 'Nome do imóvel do confrontante (doc 03 SEAPA)';

-- 4. DESPESAS
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS projeto_id INTEGER REFERENCES projetos(id) ON DELETE SET NULL;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_vencimento DATE;

-- 5. ORCAMENTOS
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS data_emissao DATE DEFAULT CURRENT_DATE;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS cliente_nome TEXT;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS projeto_id INTEGER REFERENCES projetos(id) ON DELETE SET NULL;

-- 6. PAGAMENTOS
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS data_vencimento DATE;

-- 7. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_despesas_projeto ON despesas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_projeto ON orcamentos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos(status);
