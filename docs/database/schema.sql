-- SCHEMA DEFINITIVO DO PROJETO DESENROLA

-- NUNCA mude estas tabelas sem consultar
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  role TEXT NOT NULL CHECK (role IN ('cliente', 'topografo', 'admin')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projetos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('individual', 'loteamento', 'regularizacao')),
  status TEXT NOT NULL CHECK (status IN ('rascunho', 'aguardando', 'em_analise', 'finalizado')),
  topografo_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projeto_id UUID REFERENCES projetos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES usuarios(id),
  numero INTEGER NOT NULL,
  geometria GEOMETRY(Polygon, 4326) NOT NULL,
  area NUMERIC,  -- em m²
  perimetro NUMERIC,  -- em m
  token TEXT UNIQUE,  -- magic link
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(projeto_id, numero)
);

CREATE TABLE confrontacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lote_id UUID REFERENCES lotes(id) ON DELETE CASCADE,
  direcao TEXT NOT NULL CHECK (direcao IN ('norte', 'sul', 'leste', 'oeste')),
  tipo TEXT NOT NULL CHECK (tipo IN ('lote_interno', 'pessoa_externa', 'rua', 'rio', 'outro')),
  vizinho_lote_id UUID REFERENCES lotes(id) ON DELETE SET NULL,  -- se lote_interno
  nome TEXT,
  cpf TEXT,
  matricula TEXT,
  descricao TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(lote_id, direcao)
);

CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lote_id UUID REFERENCES lotes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('memorial', 'planta', 'relatorio', 'sigef')),
  formato TEXT NOT NULL CHECK (formato IN ('pdf', 'dwg', 'xml', 'ods')),
  arquivo_url TEXT NOT NULL,
  template_usado TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lote_id UUID REFERENCES lotes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('escritura', 'iptu', 'foto', 'outro')),
  arquivo_url TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  tamanho INTEGER,  -- bytes
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices espaciais (IMPORTANTE!)
CREATE INDEX idx_lotes_geometria ON lotes USING GIST (geometria);
CREATE INDEX idx_confrontacoes_lote ON confrontacoes(lote_id);
CREATE INDEX idx_confrontacoes_vizinho ON confrontacoes(vizinho_lote_id);

-- SQL Function (PostGIS) para Identificação de Vizinhos
CREATE OR REPLACE FUNCTION buscar_vizinhos(
  lote_id_param UUID,
  projeto_id_param UUID
)
RETURNS TABLE (
  id UUID,
  numero INTEGER,
  cliente_nome TEXT,
  cliente_cpf TEXT,
  azimute NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l2.id,
    l2.numero,
    u.nome as cliente_nome,
    u.cpf as cliente_cpf,
    DEGREES(ST_Azimuth(
      ST_Centroid((SELECT geometria FROM lotes WHERE id = lote_id_param)),
      ST_Centroid(l2.geometria)
    )) as azimute
  FROM lotes l2
  LEFT JOIN usuarios u ON l2.cliente_id = u.id
  WHERE l2.projeto_id = projeto_id_param
    AND l2.id != lote_id_param
    AND ST_Touches(
      (SELECT geometria FROM lotes WHERE id = lote_id_param),
      l2.geometria
    );
END;
$$ LANGUAGE plpgsql;
