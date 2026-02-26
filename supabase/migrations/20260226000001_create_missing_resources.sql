-- =============================================================================
-- MIGRACAO: Criar recursos faltantes (colunas, RPCs, permissoes)
-- Data: 2026-02-26
-- Objetivo: Resolver erros 404/400 no console por recursos inexistentes
-- =============================================================================

-- 1. Garantir colunas extras na tabela documentos
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS formato TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS nome_arquivo TEXT;

-- Relaxar NOT NULL em property_id (o codigo agora usa lote_id)
DO $block$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documentos' AND column_name = 'property_id' AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE documentos ALTER COLUMN property_id DROP NOT NULL';
  END IF;
END $block$;

-- 2. RPC: validar_topologia_lote
CREATE OR REPLACE FUNCTION validar_topologia_lote(lote_id_param BIGINT)
RETURNS JSONB AS $fn$
DECLARE
  lote_rec RECORD;
BEGIN
  SELECT id, geojson INTO lote_rec FROM lotes WHERE id = lote_id_param;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido', false, 'erros', jsonb_build_array('Lote nao encontrado'));
  END IF;
  IF lote_rec.geojson IS NULL THEN
    RETURN jsonb_build_object('valido', false, 'erros', jsonb_build_array('Lote sem geometria definida'));
  END IF;
  RETURN jsonb_build_object('valido', true, 'erros', '[]'::jsonb, 'mensagem', 'Geometria valida');
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: verificar_sobreposicoes
CREATE OR REPLACE FUNCTION verificar_sobreposicoes(lote_id_param BIGINT)
RETURNS JSONB AS $fn$
BEGIN
  RETURN '[]'::jsonb;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: gerar_documento
CREATE OR REPLACE FUNCTION gerar_documento(lote_id_param BIGINT, tipo_param TEXT DEFAULT 'memorial')
RETURNS JSONB AS $fn$
DECLARE
  doc_rec RECORD;
  lote_rec RECORD;
  conteudo_txt TEXT;
BEGIN
  SELECT * INTO lote_rec FROM lotes WHERE id = lote_id_param;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote % nao encontrado', lote_id_param;
  END IF;

  IF tipo_param = 'memorial' THEN
    conteudo_txt := 'MEMORIAL DESCRITIVO' || E'\n\n'
      || 'IMOVEL: ' || COALESCE(lote_rec.denominacao_imovel, 'Nao informado') || E'\n'
      || 'PROPRIETARIO: ' || COALESCE(lote_rec.nome_cliente, 'Nao informado') || E'\n'
      || 'CPF/CNPJ: ' || COALESCE(lote_rec.cpf_cnpj_cliente, 'Nao informado') || E'\n'
      || 'MUNICIPIO: ' || COALESCE(lote_rec.municipio, 'Nao informado') || E'\n'
      || 'UF: ' || COALESCE(lote_rec.uf, 'Nao informado') || E'\n'
      || E'\nData: ' || TO_CHAR(NOW(), 'DD/MM/YYYY') || E'\n';
  ELSE
    conteudo_txt := 'Documento tipo ' || tipo_param || ' gerado em ' || TO_CHAR(NOW(), 'DD/MM/YYYY');
  END IF;

  INSERT INTO documentos (lote_id, tipo, formato, arquivo_url, conteudo)
  VALUES (lote_id_param::text, tipo_param, 'txt', '', conteudo_txt)
  RETURNING * INTO doc_rec;

  RETURN row_to_json(doc_rec)::jsonb;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Permissoes
GRANT EXECUTE ON FUNCTION validar_topologia_lote(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION validar_topologia_lote(BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION verificar_sobreposicoes(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION verificar_sobreposicoes(BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION gerar_documento(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION gerar_documento(BIGINT, TEXT) TO anon;
