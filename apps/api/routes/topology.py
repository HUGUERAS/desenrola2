from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Optional
from auth import get_perfil, require_topografo
from db import supabase

router = APIRouter(prefix="/api/topology", tags=["Topologia"])

@router.get("/lotes/{lote_id}/confrontacoes")
async def listar_confrontacoes(lote_id: int, perfil: dict = Depends(get_perfil)):
    # No projeto original a tabela é confrontacoes e usa lote_id
    res = supabase.table("confrontacoes").select("*").eq("lote_id", lote_id).execute()
    return {"confrontacoes": res.data or []}

@router.post("/lotes/{lote_id}/identificar-vizinhos")
async def identificar_vizinhos(lote_id: int, perfil: dict = Depends(require_topografo)):
    # RPC busca vizinhos no PostGIS
    try:
        res = supabase.rpc("buscar_vizinhos_adjacentes", {"lote_id_param": lote_id}).execute()
        return {"vizinhos": res.data or []}
    except Exception:
        return {"vizinhos": [], "message": "Função espacial não configurada"}
