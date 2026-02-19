from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from models.schemas import (
    OrcamentoCreate, OrcamentoUpdate,
    DespesaCreate, DespesaUpdate,
    PagamentoCreate, PagamentoUpdate,
)
from auth import require_topografo, get_perfil
from db import supabase

router = APIRouter(prefix="/api", tags=["Financeiro"])

@router.get("/orcamentos")
async def listar_orcamentos(lote_id: Optional[int] = None, perfil: dict = Depends(require_topografo)):
    query = supabase.table("orcamentos").select("*")
    if lote_id:
        query = query.eq("lote_id", lote_id)
    res = query.execute()
    return res.data or []

@router.post("/orcamentos")
async def criar_orcamento(data: OrcamentoCreate, perfil: dict = Depends(require_topografo)):
    payload = {
        "lote_id": data.lote_id,
        "valor": data.valor,
        "status": data.status or "RASCUNHO",
        "observacoes": data.observacoes,
    }
    res = supabase.table("orcamentos").insert(payload).execute()
    return res.data[0] if res.data else {"ok": True}

@router.get("/despesas")
async def listar_despesas(perfil: dict = Depends(require_topografo)):
    res = supabase.table("despesas").select("*").execute()
    return res.data or []

@router.post("/despesas")
async def criar_despesa(data: DespesaCreate, perfil: dict = Depends(require_topografo)):
    payload = {
        "descricao": data.descricao,
        "valor": data.valor,
        "data": str(data.data) if data.data else None,
        "categoria": data.categoria,
        "observacoes": data.observacoes,
    }
    res = supabase.table("despesas").insert(payload).execute()
    return res.data[0] if res.data else {"ok": True}
