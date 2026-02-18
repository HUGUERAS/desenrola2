"""
Router: Topology — Endpoint de identificação de vizinhos
⚠️ Processa 1 LOTE POR VEZ!
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, List
from models.schemas import ConfrontacaoSalvar
from services.topology import topology_service
from database import supabase

router = APIRouter(prefix="/api/topology", tags=["Topology"])


@router.post("/lotes/{lote_id}/identificar-vizinhos")
async def identificar_vizinhos(lote_id: str) -> Dict:
    """
    Identifica vizinhos de UM lote específico.
    ⚠️ NÃO processa todos os lotes de uma vez!

    1. Busca geometria do lote selecionado
    2. Busca APENAS lotes adjacentes (PostGIS ST_Touches)
    3. Calcula direção cardeal (N, S, L, O)
    4. Retorna para REVISÃO (não salva automaticamente)
    """
    try:
        resultado = await topology_service.identificar_vizinhos_lote(lote_id)
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/confrontacoes/salvar")
async def salvar_confrontacoes(confrontacoes: List[ConfrontacaoSalvar]) -> Dict:
    """
    Salva confrontações APÓS revisão do topógrafo.
    Processa cada confrontação individualmente.
    """
    try:
        salvos = []
        for conf in confrontacoes:
            response = supabase.table("confrontacoes").upsert({
                "lote_id": conf.lote_id,
                "direcao": conf.direcao.value,
                "tipo": conf.tipo.value,
                "vizinho_lote_id": conf.vizinho_lote_id,
                "nome": conf.nome,
                "cpf": conf.cpf,
                "matricula": conf.matricula,
                "descricao": conf.descricao,
            }, on_conflict="lote_id,direcao").execute()

            salvos.append(response.data[0] if response.data else None)

        return {
            "success": True,
            "message": f"{len(salvos)} confrontações salvas",
            "data": salvos
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lotes/{lote_id}/confrontacoes")
async def get_confrontacoes(lote_id: str) -> Dict:
    """Busca confrontações salvas de um lote."""
    try:
        response = supabase.table("confrontacoes") \
            .select("*, vizinho:lotes!vizinho_lote_id(numero, cliente:usuarios!cliente_id(nome, cpf))") \
            .eq("lote_id", lote_id) \
            .execute()

        return {"success": True, "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
