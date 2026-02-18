"""
Router: Projetos — CRUD com multitenant.
✅ RBAC: topógrafo cria/edita, proprietário não acessa lista.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict
from models.schemas import ProjetoCreate, ProjetoUpdate
from auth import get_perfil, require_topografo
from db import supabase

router = APIRouter(prefix="/api/projetos", tags=["Projetos"])


def _projeto_autorizado(projeto_id: int, perfil: dict) -> None:
    """Levanta 403 se projeto não pertence ao tenant do topógrafo."""
    if perfil.get("role") == "proprietario":
        raise HTTPException(
            status_code=403, detail="Proprietário não tem acesso a projetos"
        )
    r = supabase.table("projetos").select("tenant_id").eq("id", projeto_id).execute()
    if not r.data or r.data[0].get("tenant_id") != perfil.get("tenant_id"):
        raise HTTPException(
            status_code=403, detail="Projeto não pertence ao seu tenant"
        )


@router.get("/")
async def listar_projetos(perfil: dict = Depends(get_perfil)):
    """Lista projetos do tenant do topógrafo."""
    try:
        query = supabase.table("projetos").select("*")
        if perfil.get("role") == "topografo" and perfil.get("tenant_id"):
            query = query.eq("tenant_id", perfil["tenant_id"])
        elif perfil.get("role") == "proprietario":
            return []
        response = query.execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{projeto_id}")
async def obter_projeto(projeto_id: int, perfil: dict = Depends(get_perfil)):
    """Obtém um projeto específico do tenant."""
    try:
        _projeto_autorizado(projeto_id, perfil)
        response = (
            supabase.table("projetos").select("*").eq("id", projeto_id).execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def criar_projeto(
    projeto: ProjetoCreate, perfil: dict = Depends(get_perfil)
):
    """Cria projeto. Topógrafo (com tenant) ou Proprietário (avulso)."""
    try:
        data = {
            "nome": projeto.nome,
            "descricao": projeto.descricao,
            "tipo": projeto.tipo,
            "status": "RASCUNHO",
            "tenant_id": perfil.get("tenant_id"),
        }
        response = supabase.table("projetos").insert(data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{projeto_id}")
async def atualizar_projeto(
    projeto_id: int, projeto: ProjetoUpdate, perfil: dict = Depends(require_topografo)
):
    """Atualiza projeto. Apenas topógrafo do tenant."""
    try:
        _projeto_autorizado(projeto_id, perfil)

        data = {}
        if projeto.nome is not None:
            data["nome"] = projeto.nome
        if projeto.descricao is not None:
            data["descricao"] = projeto.descricao
        if projeto.tipo is not None:
            data["tipo"] = projeto.tipo
        if projeto.status is not None:
            data["status"] = projeto.status

        if not data:
            raise HTTPException(
                status_code=400, detail="Nenhum campo fornecido para atualização"
            )

        response = (
            supabase.table("projetos").update(data).eq("id", projeto_id).execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{projeto_id}")
async def deletar_projeto(
    projeto_id: int, perfil: dict = Depends(require_topografo)
):
    """Deleta projeto. Apenas topógrafo do tenant."""
    try:
        _projeto_autorizado(projeto_id, perfil)
        response = supabase.table("projetos").delete().eq("id", projeto_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        return {"ok": True, "message": "Projeto deletado com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Sobreposições por projeto ──

@router.get("/{projeto_id}/sobreposicoes")
async def sobreposicoes_projeto(
    projeto_id: int, perfil: dict = Depends(get_perfil)
):
    """Detecta sobreposições entre lotes de um projeto."""
    try:
        _projeto_autorizado(projeto_id, perfil)
        response = supabase.rpc(
            "detectar_sobreposicoes_projeto", {"p_projeto_id": projeto_id}
        ).execute()
        return response.data or []
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
