"""
Router: Documentos — Geração e listagem.
✅ Mapeamento: lote_id → property_id (Supabase)
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from auth import get_perfil, require_topografo
from db import supabase
from services.documents import gerar_memorial_texto, save_document_record

router = APIRouter(prefix="/api/documents", tags=["Documentos"])

@router.post("/gerar/{lote_id}")
def gerar_documento(lote_id: str, perfil: dict = Depends(require_topografo)):
    """Gera um documento para o lote (Ex: Memorial). Apenas topógrafos."""
    try:
        # 1. Buscar dados da property
        lote_res = supabase.table("properties").select("*").eq("id", lote_id).execute()
        if not lote_res.data:
            raise HTTPException(status_code=404, detail="Lote não encontrado")
        lote = lote_res.data[0]

        # 2. Buscar confrontações
        vizinhos_res = supabase.table("confrontacoes").select("*").eq("property_id", lote_id).execute()
        vizinhos = vizinhos_res.data or []

        # 3. Gerar conteúdo
        conteudo = gerar_memorial_texto(lote, vizinhos)
        fake_url = f"https://api.desenrola.com/docs/{lote_id}/{datetime.now().timestamp()}.txt"
        
        # 4. Salvar registro
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
        response = supabase.table("documentos").select("*").eq("property_id", lote_id).execute()
        return response.data or []
    except Exception as e:
        err_str = str(e)
        # PGRST205: table doesn't exist yet — return empty list gracefully
        if "PGRST205" in err_str or "documentos" in err_str:
            return []
        raise HTTPException(status_code=500, detail=err_str)
