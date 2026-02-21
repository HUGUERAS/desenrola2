-- Campos para fluxo do cliente via magic link
-- Lote: dados expandidos do proprietário e do imóvel
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS token_acesso TEXT UNIQUE;
ALTER TABLE lotes ADD COLUMN
IF NOT EXISTS municipio TEXT;
ALTER TABLE lotes ADD COLUMN
IF NOT EXISTS uf TEXT;
ALTER TABLE lotes ADD COLUMN
IF NOT EXISTS comarca TEXT;
ALTER TABLE lotes ADD COLUMN
IF NOT EXISTS codigo_sigef TEXT;
ALTER TABLE lotes ADD COLUMN
IF NOT EXISTS rg_cliente TEXT;
ALTER TABLE lotes ADD COLUMN
IF NOT EXISTS estado_civil_cliente TEXT;
ALTER TABLE lotes ADD COLUMN
IF NOT EXISTS denominacao_imovel TEXT;
ALTER TABLE lotes ADD COLUMN
IF NOT EXISTS matricula_imovel TEXT;

-- Confrontações: suporte a segmentos (por aresta do polígono)
-- direcao continua existindo para compatibilidade com fluxo do topógrafo
ALTER TABLE confrontacoes ADD COLUMN
IF NOT EXISTS segmento_index INTEGER;
ALTER TABLE confrontacoes ADD COLUMN
IF NOT EXISTS confrontante_tipo TEXT DEFAULT 'FAZENDA';
ALTER TABLE confrontacoes ADD COLUMN
IF NOT EXISTS nome TEXT;
ALTER TABLE confrontacoes ADD COLUMN
IF NOT EXISTS cpf TEXT;
