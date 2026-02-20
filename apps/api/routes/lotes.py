from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
import uuid
from db import supabase
from auth import get_perfil, require_topografo
from models.schemas import LoteCreate, GeometriaInput, StatusLoteInput, SalvarConfrontacoesInput

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


@router.patch("/{lote_id}/status")
async def atualizar_status_lote(lote_id: int, body: StatusLoteInput, perfil: dict = Depends(get_perfil)):
    """Atualiza status do lote."""
    res = supabase.table("lotes").update({"status": body.status}).eq("id", lote_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Lote nao encontrado")
    return res.data[0]


# ==================== CONFRONTACOES ====================

@router.get("/{lote_id}/confrontacoes")
async def listar_confrontacoes_lote(lote_id: int, perfil: dict = Depends(get_perfil)):
    """Lista confrontacoes do lote."""
    res = supabase.table("confrontacoes").select("*").eq("lote_id", lote_id).execute()
    return {"confrontacoes": res.data or []}


@router.post("/{lote_id}/identificar-vizinhos")
async def identificar_vizinhos_lote(lote_id: int, perfil: dict = Depends(require_topografo)):
    """Identifica vizinhos via PostGIS RPC."""
    try:
        res = supabase.rpc("buscar_vizinhos_adjacentes", {"lote_id_param": lote_id}).execute()
        return {"vizinhos": res.data or []}
    except Exception:
        return {"vizinhos": [], "message": "Funcao espacial nao configurada"}


@router.get("/{lote_id}/sobreposicoes")
async def obter_sobreposicoes_lote(lote_id: int, perfil: dict = Depends(get_perfil)):
    """Verifica sobreposicoes do lote."""
    try:
        res = supabase.rpc("verificar_sobreposicoes", {"lote_id_param": lote_id}).execute()
        return {"sobreposicoes": res.data or []}
    except Exception:
        return {"sobreposicoes": [], "message": "Funcao espacial nao configurada"}


@router.post("/{lote_id}/validar-topologia")
async def validar_topologia_lote(lote_id: int, perfil: dict = Depends(get_perfil)):
    """Valida topologia do lote."""
    try:
        res = supabase.rpc("validar_topologia_lote", {"lote_id_param": lote_id}).execute()
        return {"resultado": res.data or {}, "valido": True}
    except Exception:
        return {"resultado": {}, "valido": False, "message": "Funcao de validacao nao configurada"}


@router.post("/{lote_id}/salvar-confrontacoes")
async def salvar_confrontacoes_lote(lote_id: int, body: SalvarConfrontacoesInput, perfil: dict = Depends(require_topografo)):
    """Salva confrontacoes revisadas pelo topografo."""
    supabase.table("confrontacoes").delete().eq("lote_id", lote_id).execute()
    registros = []
    for v in body.vizinhos:
        registro = {
            "lote_id": lote_id,
            "direcao": v.direcao,
            "numero": v.numero,
        }
        if v.lote_id and not v.lote_id.startswith("manual"):
            registro["vizinho_lote_id"] = int(v.lote_id) if v.lote_id.isdigit() else None
        registros.append(registro)
    if registros:
        supabase.table("confrontacoes").insert(registros).execute()
    return {"ok": True, "total": len(registros)}
