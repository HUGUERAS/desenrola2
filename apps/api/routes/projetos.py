from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List, Dict, Any

from models.schemas import ProjectCreateSchema, ProjectUpdateSchema # Precisaremos criar esses schemas
from auth import require_topografo # Assumindo que a criação/gerenciamento é para topógrafos
from db import supabase

router = APIRouter(prefix="/api", tags=["Projetos"])

def _first_or_500(res, entidade: str):
    if res.data:
        return res.data[0]
    # Se res.data for None ou vazio, mas a operação foi bem sucedida (ex: DELETE), retornar OK
    if res.count == 0 and res.status_code == 200: 
        return {"message": f"{entidade} excluido com sucesso."}
    elif res.count == 0: # Algo deu errado e não retornou dado
        raise HTTPException(status_code=404, detail=f"{entidade} não encontrado ou erro na operação")
    else:
        raise HTTPException(status_code=500, detail=f"Falha ao processar {entidade}")


# ── Schemas de Request Body (precisarão ser criados em models/schemas.py) ──
# Para simplificar aqui, vamos usar Dict ou Any, mas o ideal é criar Pydantic models

@router.get("/projetos")
async def listar_projetos(topografo_id: Optional[str] = None, perfil: dict = Depends(require_topografo)):
    """Lista projetos, opcionalmente filtrando pelo topógrafo logado."""
    user_id = perfil.get("user_id")
    query = supabase.table("projetos").select("*")
    
    # Se o usuário logado é topógrafo, filtrar por ele
    # Se for outro perfil (ex: admin geral), talvez precise de outro filtro
    if user_id:
        query = query.eq("responsavel_topografo_id", user_id)
    
    res = query.execute()
    return res.data or []

@router.post("/projetos")
async def criar_projeto(data: Dict[str, Any], perfil: dict = Depends(require_topografo)):
    """Cria um novo projeto."""
    user_id = perfil.get("user_id")
    payload = {
        "nome_projeto": data.get("nomeProjeto"),
        "nome_cliente": data.get("nomeCliente"),
        "cpf_cnpj_cliente": data.get("cpfCnpjCliente"),
        "municipio": data.get("municipio"),
        "uf": data.get("uf"),
        "status_projeto": data.get("statusProjeto", "Rascunho"),
        "responsavel_topografo_id": user_id, # Associa ao usuário logado
    }

    # Campos opcionais que podem ser passados
    opcionais = ["descricao", "data_ultima_atividade", "data_criacao"]
    for campo in opcionais:
        if campo in data and data[campo] is not None:
            payload[campo] = data[campo]

    # Validações básicas antes de salvar
    if not payload.get("nome_projeto") or not payload.get("nome_cliente"):
        raise HTTPException(status_code=400, detail="Nome do projeto e nome do cliente são obrigatórios")

    res = supabase.table("projetos").insert(payload).execute()
    return _first_or_500(res, "projeto")

@router.get("/projetos/{projeto_id}")
async def obter_projeto(projeto_id: int, perfil: dict = Depends(require_topografo)):
    """Retorna os detalhes de um projeto específico."""
    res = supabase.table("projetos").select("*").eq("id", projeto_id).execute()
    return _first_or_500(res, "projeto")

@router.put("/projetos/{projeto_id}")
async def atualizar_projeto(projeto_id: int, data: Dict[str, Any], perfil: dict = Depends(require_topografo)):
    """Atualiza um projeto existente."""
    # Precisamos garantir que o usuário logado é o responsável ou tem permissão
    # Verificação simples: pegar o projeto atual e checar o responsavel_topografo_id
    projeto_atual = await obter_projeto(projeto_id, perfil) # Reusa a função de obter
    if projeto_atual.get("responsavel_topografo_id") != perfil.get("user_id"):
        raise HTTPException(status_code=403, detail="Você não tem permissão para editar este projeto")

    payload = {}
    campos_permitidos = [
        "nome_projeto", "nome_cliente", "cpf_cnpj_cliente", "municipio", "uf",
        "status_projeto", "data_ultima_atividade", "descricao"
    ]
    for campo in campos_permitidos:
        if campo in data and data[campo] is not None:
            payload[campo] = data[campo]

    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar foi fornecido")

    res = supabase.table("projetos").update(payload).eq("id", projeto_id).execute()
    return _first_or_500(res, "projeto")

@router.delete("/projetos/{projeto_id}")
async def excluir_projeto(projeto_id: int, perfil: dict = Depends(require_topografo)):
    """Exclui um projeto."""
    # Similar à atualização, verificar permissão
    projeto_atual = await obter_projeto(projeto_id, perfil)
    if projeto_atual.get("responsavel_topografo_id") != perfil.get("user_id"):
        raise HTTPException(status_code=403, detail="Você não tem permissão para excluir este projeto")

    # Antes de excluir o projeto, pode ser necessário excluir ou desassociar lotes e documentos relacionados.
    # Para este exemplo, vamos apenas excluir o projeto principal.
    res = supabase.table("projetos").delete().eq("id", projeto_id).execute()
    return _first_or_500(res, "projeto")
