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

# ==================== ORCAMENTOS ====================

@router.get("/orcamentos")
async def listar_orcamentos(
    lote_id: Optional[int] = None,
    projeto_id: Optional[int] = None,
    perfil: dict = Depends(require_topografo),
):
    query = supabase.table("orcamentos").select("*")
    if lote_id:
        query = query.eq("lote_id", lote_id)
    if projeto_id:
        query = query.eq("projeto_id", projeto_id)
    res = query.execute()
    return res.data or []


@router.post("/orcamentos")
async def criar_orcamento(data: OrcamentoCreate, perfil: dict = Depends(require_topografo)):
    payload = {
        "valor": data.valor,
        "status": data.status or "RASCUNHO",
        "observacoes": data.observacoes,
    }
    if data.lote_id is not None:
        payload["lote_id"] = data.lote_id
    if data.projeto_id is not None:
        payload["projeto_id"] = data.projeto_id
    if data.data_emissao is not None:
        payload["data_emissao"] = data.data_emissao
    if data.data_vencimento is not None:
        payload["data_vencimento"] = data.data_vencimento
    if data.cliente_nome is not None:
        payload["cliente_nome"] = data.cliente_nome
    res = supabase.table("orcamentos").insert(payload).execute()
    return res.data[0] if res.data else {"ok": True}


@router.put("/orcamentos/{orcamento_id}")
async def atualizar_orcamento(orcamento_id: int, data: OrcamentoUpdate, perfil: dict = Depends(require_topografo)):
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    res = supabase.table("orcamentos").update(payload).eq("id", orcamento_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Orcamento nao encontrado")
    return res.data[0]


@router.delete("/orcamentos/{orcamento_id}")
async def excluir_orcamento(orcamento_id: int, perfil: dict = Depends(require_topografo)):
    res = supabase.table("orcamentos").delete().eq("id", orcamento_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Orcamento nao encontrado")
    return {"ok": True}


# ==================== DESPESAS ====================

@router.get("/despesas")
async def listar_despesas(
    projeto_id: Optional[int] = None,
    perfil: dict = Depends(require_topografo),
):
    query = supabase.table("despesas").select("*")
    if projeto_id:
        query = query.eq("projeto_id", projeto_id)
    res = query.execute()
    return res.data or []


@router.post("/despesas")
async def criar_despesa(data: DespesaCreate, perfil: dict = Depends(require_topografo)):
    payload = {
        "projeto_id": data.projeto_id,
        "descricao": data.descricao,
        "valor": data.valor,
        "data": str(data.data) if data.data else None,
        "data_vencimento": str(data.data_vencimento) if data.data_vencimento else None,
        "categoria": data.categoria,
        "observacoes": data.observacoes,
    }
    res = supabase.table("despesas").insert(payload).execute()
    return res.data[0] if res.data else {"ok": True}


@router.put("/despesas/{despesa_id}")
async def atualizar_despesa(despesa_id: int, data: DespesaUpdate, perfil: dict = Depends(require_topografo)):
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    res = supabase.table("despesas").update(payload).eq("id", despesa_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Despesa nao encontrada")
    return res.data[0]


@router.delete("/despesas/{despesa_id}")
async def excluir_despesa(despesa_id: int, perfil: dict = Depends(require_topografo)):
    res = supabase.table("despesas").delete().eq("id", despesa_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Despesa nao encontrada")
    return {"ok": True}


# ==================== PAGAMENTOS ====================

@router.get("/pagamentos")
async def listar_pagamentos(
    lote_id: Optional[int] = None,
    projeto_id: Optional[int] = None,
    perfil: dict = Depends(require_topografo),
):
    query = supabase.table("pagamentos").select("*")
    if lote_id:
        query = query.eq("lote_id", lote_id)
    if projeto_id:
        query = query.eq("projeto_id", projeto_id)
    res = query.execute()
    return res.data or []


@router.post("/pagamentos")
async def criar_pagamento(data: PagamentoCreate, perfil: dict = Depends(require_topografo)):
    payload = {
        "lote_id": data.lote_id,
        "valor_total": data.valor_total,
        "valor_pago": data.valor_pago or 0.0,
        "status": data.status or "PENDENTE",
    }
    if data.data_pagamento is not None:
        payload["data_pagamento"] = data.data_pagamento
    if data.data_vencimento is not None:
        payload["data_vencimento"] = data.data_vencimento
    if data.metodo_pagamento is not None:
        payload["metodo_pagamento"] = data.metodo_pagamento
    if data.observacoes is not None:
        payload["observacoes"] = data.observacoes
    res = supabase.table("pagamentos").insert(payload).execute()
    return res.data[0] if res.data else {"ok": True}


@router.put("/pagamentos/{pagamento_id}")
async def atualizar_pagamento(pagamento_id: int, data: PagamentoUpdate, perfil: dict = Depends(require_topografo)):
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    res = supabase.table("pagamentos").update(payload).eq("id", pagamento_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Pagamento nao encontrado")
    return res.data[0]


@router.delete("/pagamentos/{pagamento_id}")
async def excluir_pagamento(pagamento_id: int, perfil: dict = Depends(require_topografo)):
    res = supabase.table("pagamentos").delete().eq("id", pagamento_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Pagamento nao encontrado")
    return {"ok": True}
