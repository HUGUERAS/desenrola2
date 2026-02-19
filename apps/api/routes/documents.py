from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from auth import get_perfil, require_topografo
from db import supabase
from models.documents import DocumentoCreate, DocumentoResponse
from services.documents import gerar_memorial_texto, save_document_record

router = APIRouter(prefix="/api/documents", tags=["Documentos"])

@router.post("/gerar/{lote_id}", response_model=DocumentoResponse)
def gerar_documento(lote_id: int, body: DocumentoCreate, perfil: dict = Depends(require_topografo)):
    """
    Gera um documento para o lote (Ex: Memorial).
    Apenas topógrafos podem gerar documentos oficiais.
    """
    try:
        # 1. Buscar dados do lote
        lote_res = supabase.table("lotes").select("*").eq("id", lote_id).execute()
        if not lote_res.data:
            raise HTTPException(status_code=404, detail="Lote não encontrado")
        lote = lote_res.data[0]

        # 2. Buscar confrontações (vizinhos)
        vizinhos_res = supabase.table("confrontacoes").select("*").eq("lote_id", lote_id).execute()
        vizinhos = vizinhos_res.data or []

        # 3. Gerar conteúdo (Mock de PDF -> Texto)
        if body.tipo == "memorial":
            conteudo = gerar_memorial_texto(lote, vizinhos)
            # Em produção: gerar PDF, upload S3/Supabase Storage, pegar URL
            fake_url = f"https://api.desenrola.com/docs/{lote_id}/{datetime.now().timestamp()}.txt"
            
            # 4. Salvar registro
            doc = save_document_record(lote_id, body.tipo, fake_url)
            return doc
        else:
            raise HTTPException(status_code=400, detail="Tipo de documento não suportado")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{lote_id}", response_model=list[DocumentoResponse])
def listar_documentos(lote_id: int, perfil: dict = Depends(get_perfil)):
    """Lista documentos de um lote."""
    try:
        response = supabase.table("documentos").select("*").eq("lote_id", lote_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
