"""
Router: Financeiro — Orçamentos, Despesas, Pagamentos.
✅ RBAC: somente topógrafo.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from models.schemas import (
    OrcamentoCreate, OrcamentoUpdate,
    DespesaCreate, DespesaUpdate,
    PagamentoCreate, PagamentoUpdate,
)
from auth import require_topografo, get_perfil
from db import supabase

router = APIRouter(prefix="/api", tags=["Financeiro"])


# ── Orçamentos ──

@router.get("/orcamentos")
async def listar_orcamentos(
    projeto_id: Optional[int] = None,
    lote_id: Optional[int] = None,
    perfil: dict = Depends(require_topografo),
):
    """Lista orçamentos do tenant."""
    try:
        query = supabase.table("orcamentos").select("*")
        if projeto_id:
            query = query.eq("projeto_id", projeto_id)
        if lote_id:
            query = query.eq("lote_id", lote_id)
        response = query.execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orcamentos")
async def criar_orcamento(data: OrcamentoCreate, perfil: dict = Depends(require_topografo)):
    """Cria orçamento."""
    try:
        payload = {
            "projeto_id": data.projeto_id,
            "lote_id": data.lote_id,
            "valor": data.valor,
            "status": data.status,
            "observacoes": data.observacoes,
            "tenant_id": perfil["tenant_id"],
        }
        response = supabase.table("orcamentos").insert(payload).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/orcamentos/{orcamento_id}")
async def atualizar_orcamento(
    orcamento_id: int, data: OrcamentoUpdate, perfil: dict = Depends(require_topografo)
):
    """Atualiza orçamento."""
    try:
        payload = {}
        if data.valor is not None:
            payload["valor"] = data.valor
        if data.status is not None:
            payload["status"] = data.status
        if data.observacoes is not None:
            payload["observacoes"] = data.observacoes
        if not payload:
            raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
        response = (
            supabase.table("orcamentos").update(payload).eq("id", orcamento_id).execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Orçamento não encontrado")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/orcamentos/{orcamento_id}")
async def deletar_orcamento(orcamento_id: int, perfil: dict = Depends(require_topografo)):
    """Deleta orçamento."""
    try:
        response = supabase.table("orcamentos").delete().eq("id", orcamento_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Orçamento não encontrado")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Despesas ──

@router.get("/despesas")
async def listar_despesas(
    projeto_id: Optional[int] = None,
    perfil: dict = Depends(require_topografo),
):
    """Lista despesas do tenant."""
    try:
        query = supabase.table("despesas").select("*")
        if projeto_id:
            query = query.eq("projeto_id", projeto_id)
        response = query.execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/despesas")
async def criar_despesa(data: DespesaCreate, perfil: dict = Depends(require_topografo)):
    """Cria despesa."""
    try:
        payload = {
            "projeto_id": data.projeto_id,
            "descricao": data.descricao,
            "valor": data.valor,
            "data": data.data,
            "categoria": data.categoria,
            "observacoes": data.observacoes,
            "tenant_id": perfil["tenant_id"],
        }
        response = supabase.table("despesas").insert(payload).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/despesas/{despesa_id}")
async def atualizar_despesa(
    despesa_id: int, data: DespesaUpdate, perfil: dict = Depends(require_topografo)
):
    """Atualiza despesa."""
    try:
        payload = {}
        if data.descricao is not None:
            payload["descricao"] = data.descricao
        if data.valor is not None:
            payload["valor"] = data.valor
        if data.data is not None:
            payload["data"] = data.data
        if data.categoria is not None:
            payload["categoria"] = data.categoria
        if data.observacoes is not None:
            payload["observacoes"] = data.observacoes
        if not payload:
            raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
        response = (
            supabase.table("despesas").update(payload).eq("id", despesa_id).execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Despesa não encontrada")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/despesas/{despesa_id}")
async def deletar_despesa(despesa_id: int, perfil: dict = Depends(require_topografo)):
    """Deleta despesa."""
    try:
        response = supabase.table("despesas").delete().eq("id", despesa_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Despesa não encontrada")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Pagamentos ──

@router.get("/pagamentos")
async def listar_pagamentos(
    projeto_id: Optional[int] = None,
    lote_id: Optional[int] = None,
    perfil: dict = Depends(require_topografo),
):
    """Lista pagamentos do tenant."""
    try:
        query = supabase.table("pagamentos").select("*")
        if projeto_id:
            query = query.eq("projeto_id", projeto_id)
        if lote_id:
            query = query.eq("lote_id", lote_id)
        response = query.execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pagamentos")
async def criar_pagamento(data: PagamentoCreate, perfil: dict = Depends(require_topografo)):
    """Cria pagamento."""
    try:
        payload = {
            "lote_id": data.lote_id,
            "valor_total": data.valor_total,
            "valor_pago": data.valor_pago,
            "status": data.status,
            "data_pagamento": data.data_pagamento,
            "metodo_pagamento": data.metodo_pagamento,
            "observacoes": data.observacoes,
            "tenant_id": perfil["tenant_id"],
        }
        response = supabase.table("pagamentos").insert(payload).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/pagamentos/{pagamento_id}")
async def atualizar_pagamento(
    pagamento_id: int, data: PagamentoUpdate, perfil: dict = Depends(require_topografo)
):
    """Atualiza pagamento."""
    try:
        payload = {}
        if data.valor_total is not None:
            payload["valor_total"] = data.valor_total
        if data.valor_pago is not None:
            payload["valor_pago"] = data.valor_pago
        if data.status is not None:
            payload["status"] = data.status
        if data.data_pagamento is not None:
            payload["data_pagamento"] = data.data_pagamento
        if data.metodo_pagamento is not None:
            payload["metodo_pagamento"] = data.metodo_pagamento
        if data.observacoes is not None:
            payload["observacoes"] = data.observacoes
        if not payload:
            raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
        response = (
            supabase.table("pagamentos").update(payload).eq("id", pagamento_id).execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Pagamento não encontrado")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/pagamentos/{pagamento_id}")
async def deletar_pagamento(pagamento_id: int, perfil: dict = Depends(require_topografo)):
    """Deleta pagamento."""
    try:
        response = supabase.table("pagamentos").delete().eq("id", pagamento_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Pagamento não encontrado")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
