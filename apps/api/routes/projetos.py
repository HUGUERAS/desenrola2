from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from db import supabase
from auth import get_perfil
from models.schemas import ProjetoCreate

router = APIRouter(prefix="/api/projetos", tags=["Projetos"])

@router.get("/")
async def listar_projetos(perfil: dict = Depends(get_perfil)):
    """Lista projetos (Aberto para qualquer perfil logado)."""
    print(f"[DEBUG] Listando projetos para o perfil: {perfil.get('user_id')}")
    query = supabase.table("projetos").select("*")
    if perfil.get("tenant_id"):
        query = query.eq("tenant_id", perfil["tenant_id"])
    res = query.execute()
    return res.data or []

@router.post("/")
async def criar_projeto(body: ProjetoCreate, perfil: dict = Depends(get_perfil)):
    """Cria projeto (Aberto para qualquer perfil logado)."""
    print(f"[DEBUG] Criando projeto '{body.nome}' para o perfil: {perfil.get('user_id')}")
    data = {
        "nome": body.nome,
        "descricao": body.descricao,
        "tipo": body.tipo,
        "tenant_id": perfil.get("tenant_id"),
    }
    if body.endereco is not None:
        data["endereco"] = body.endereco
    if body.cidade is not None:
        data["cidade"] = body.cidade
    if body.estado is not None:
        data["estado"] = body.estado
    if body.observacoes is not None:
        data["observacoes"] = body.observacoes
    res = supabase.table("projetos").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erro ao criar projeto na base de dados")
    return res.data[0]
