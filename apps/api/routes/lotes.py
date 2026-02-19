from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
import uuid
from db import supabase
from auth import get_perfil, require_topografo
from models.schemas import LoteCreate, GeometriaInput, StatusLoteInput

router = APIRouter(prefix="/api/lotes", tags=["Lotes"])

@router.get("/")
async def listar_lotes(projeto_id: Optional[int] = None, perfil: dict = Depends(get_perfil)):
    """Lista lotes usando a tabela 'lotes' de 'agora sim'."""
    query = supabase.table("lotes").select("*")
    
    if perfil.get("role") == "proprietario":
        query = query.eq("email_cliente", perfil.get("email"))
    elif projeto_id:
        query = query.eq("projeto_id", projeto_id)
        
    res = query.execute()
    return res.data or []

@router.post("/")
async def criar_lote(body: LoteCreate, perfil: dict = Depends(get_perfil)):
    """Cria lote usando as colunas originais do 'agora sim'."""
    data = {
        "projeto_id": body.projeto_id,
        "nome_cliente": body.nome_cliente,
        "email_cliente": body.email_cliente,
        "telefone_cliente": body.telefone_cliente,
        "cpf_cnpj_cliente": body.cpf_cnpj_cliente,
        "token_acesso": str(uuid.uuid4()),
        "status": "PENDENTE"
    }
    res = supabase.table("lotes").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erro ao criar lote")
    return res.data[0]

@router.get("/{lote_id}")
async def obter_lote(lote_id: int, perfil: dict = Depends(get_perfil)):
    res = supabase.table("lotes").select("*").eq("id", lote_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    return res.data[0]

@router.put("/{lote_id}/geometria")
async def atualizar_geometria(lote_id: int, body: GeometriaInput, perfil: dict = Depends(get_perfil)):
    res = supabase.table("lotes").update({"status": "DESENHO"}).eq("id", lote_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Erro ao salvar geometria")
    return res.data[0]

@router.get("/acesso/{token}")
async def obter_lote_por_token(token: str):
    res = supabase.table("lotes").select("*").eq("token_acesso", token).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Link inválido")
    return res.data[0]
