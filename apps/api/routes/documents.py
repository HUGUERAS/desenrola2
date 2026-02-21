"""
Router: Documentos — Geração e listagem.
Padrao: lote_id (com fallback property_id legado)
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from auth import get_perfil, require_topografo
from services.documents import (
    gerar_memorial_texto,
    get_confrontacoes_by_lote,
    get_lote_by_id,
    list_documentos_by_lote,
    save_document_record,
)

router = APIRouter(prefix="/api/documents", tags=["Documentos"])

@router.post("/gerar/{lote_id}")
def gerar_documento(lote_id: str, perfil: dict = Depends(require_topografo)):
    """Gera um documento para o lote (Ex: Memorial). Apenas topógrafos."""
    try:
        lote = get_lote_by_id(lote_id)
        if not lote:
            raise HTTPException(status_code=404, detail="Lote não encontrado")

        vizinhos = get_confrontacoes_by_lote(lote_id)

        conteudo = gerar_memorial_texto(lote, vizinhos)
        fake_url = f"https://api.desenrola.com/docs/{lote_id}/{datetime.now().timestamp()}.txt"

        doc = save_document_record(lote_id, "memorial", fake_url, conteudo)
        return doc

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{lote_id}")
def listar_documentos(lote_id: str, perfil: dict = Depends(get_perfil)):
    """Lista documentos de um lote."""
    try:
        return list_documentos_by_lote(lote_id)
    except Exception as e:
        err_str = str(e)
        # PGRST205: table doesn't exist yet — return empty list gracefully
        if "PGRST205" in err_str or "documentos" in err_str:
            return []
        raise HTTPException(status_code=500, detail=err_str)
