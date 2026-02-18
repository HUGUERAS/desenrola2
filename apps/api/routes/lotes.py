"""
Router: Lotes — CRUD + Topology + Confrontações.
✅ RBAC: topógrafo CRUD, proprietário leitura.
✅ Geometria: WKT com SRID=4674 (SIRGAS 2000).
✅ Topologia: buscar_vizinhos_adjacentes (1 lote por vez).
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from time import perf_counter
import uuid

from models.schemas import (
    LoteCreate,
    GeometriaInput,
    StatusLoteInput,
    SalvarConfrontacoesInput,
    ValidarTopologiaInput,
    VizinhoInput,
)
from auth import get_perfil, require_topografo
from db import supabase

router = APIRouter(prefix="/api/lotes", tags=["Lotes"])


# ── Helpers de Autorização ──

def _lote_autorizado(lote_id: int, perfil: dict, escrita: bool = False) -> dict:
    """Verifica se usuário pode acessar lote. Retorna o lote ou levanta 403/404."""
    r = supabase.table("lotes").select("*").eq("id", lote_id).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    lote = r.data[0]
    if perfil.get("role") == "topografo":
        proj = (
            supabase.table("projetos")
            .select("tenant_id")
            .eq("id", lote["projeto_id"])
            .execute()
        )
        tenant = proj.data[0].get("tenant_id") if proj.data else None
        if tenant != perfil.get("tenant_id"):
            raise HTTPException(
                status_code=403, detail="Lote não pertence ao seu tenant"
            )
    elif perfil.get("role") == "proprietario":
        if lote.get("email_cliente") != perfil.get("email"):
            raise HTTPException(status_code=403, detail="Lote não pertence a você")
        # Removido bloqueio de escrita para proprietário conseguir auto-salvar desenho
    return lote


def _direcao_por_azimute(azimute_graus: float) -> str:
    """Converte azimute (0-360°) para direção cardeal."""
    azimute = azimute_graus % 360
    if 45 <= azimute < 135:
        return "leste"
    if 135 <= azimute < 225:
        return "sul"
    if 225 <= azimute < 315:
        return "oeste"
    return "norte"


# ── CRUD Lotes ──

@router.get("/")
async def listar_lotes(
    projeto_id: Optional[int] = None, perfil: dict = Depends(get_perfil)
):
    """Lista lotes. Topógrafo: do tenant. Proprietário: só os seus."""
    try:
        if perfil.get("role") == "proprietario":
            query = (
                supabase.table("lotes")
                .select("*")
                .eq("email_cliente", perfil.get("email", ""))
            )
        else:
            query = supabase.table("lotes").select("*")
            if projeto_id:
                query = query.eq("projeto_id", projeto_id)
            if perfil.get("role") == "topografo" and perfil.get("tenant_id"):
                projs = (
                    supabase.table("projetos")
                    .select("id")
                    .eq("tenant_id", perfil["tenant_id"])
                    .execute()
                )
                ids = [p["id"] for p in (projs.data or [])]
                if ids:
                    query = query.in_("projeto_id", ids)
                else:
                    return []
        response = query.execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def criar_lote(lote: LoteCreate, perfil: dict = Depends(get_perfil)):
    """Cria lote. Topógrafo (do tenant) ou Proprietário (próprio)."""
    try:
        if perfil.get("role") == "topografo":
            r = (
                supabase.table("projetos")
                .select("tenant_id")
                .eq("id", lote.projeto_id)
                .execute()
            )
            if not r.data or r.data[0].get("tenant_id") != perfil.get("tenant_id"):
                raise HTTPException(
                    status_code=403, detail="Projeto não pertence ao seu tenant"
                )

        token = str(uuid.uuid4())
        data = {
            "projeto_id": lote.projeto_id,
            "nome_cliente": lote.nome_cliente,
            "email_cliente": lote.email_cliente,
            "telefone_cliente": lote.telefone_cliente,
            "cpf_cnpj_cliente": lote.cpf_cnpj_cliente,
            "token_acesso": token,
            "link_expira_em": (datetime.now() + timedelta(days=7)).isoformat(),
            "status": "PENDENTE",
        }

        # Geometria WKT com SRID=4674 (SIRGAS 2000)
        if lote.geom_wkt:
            data["geom"] = f"SRID=4674;{lote.geom_wkt}"

        response = supabase.table("lotes").insert(data).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{lote_id}")
async def obter_lote(lote_id: int, perfil: dict = Depends(get_perfil)):
    """Obtém lote com verificação de acesso."""
    try:
        return _lote_autorizado(lote_id, perfil, escrita=False)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{lote_id}/geometria")
async def atualizar_geometria(
    lote_id: int, body: GeometriaInput, perfil: dict = Depends(get_perfil)
):
    """Atualiza geometria do lote (WKT → SRID=4674)."""
    try:
        _lote_autorizado(lote_id, perfil, escrita=True)
        data = {"geom": f"SRID=4674;{body.geom_wkt}", "status": "DESENHO"}
        response = supabase.table("lotes").update(data).eq("id", lote_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Lote não encontrado")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{lote_id}/status")
async def atualizar_status(
    lote_id: int, body: StatusLoteInput, perfil: dict = Depends(require_topografo)
):
    """Atualiza status do lote (PENDENTE → DESENHO → VALIDACAO → APROVADO)."""
    try:
        _lote_autorizado(lote_id, perfil, escrita=True)
        response = (
            supabase.table("lotes")
            .update({"status": body.status})
            .eq("id", lote_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Lote não encontrado")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Magic Link (acesso cliente) ──

@router.get("/acesso/{token}")
async def obter_lote_por_token(token: str):
    """Magic Link: cliente acessa lote pelo token."""
    try:
        response = (
            supabase.table("lotes").select("*").eq("token_acesso", token).execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Link inválido ou expirado")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Topologia: Identificar Vizinhos ──

@router.post("/{lote_id}/identificar-vizinhos")
async def identificar_vizinhos(
    lote_id: int, perfil: dict = Depends(require_topografo)
) -> Dict[str, Any]:
    """
    Identifica vizinhos de UM lote específico.
    ⚠️ NÃO processa todos os lotes de uma vez!

    1. Chama RPC buscar_vizinhos_adjacentes
    2. Converte azimute → direção cardeal
    3. Agrupa por direção
    4. Retorna para REVISÃO (não salva automaticamente)
    """
    try:
        _lote_autorizado(lote_id, perfil, escrita=True)
        started_at = perf_counter()

        rpc_response = supabase.rpc(
            "buscar_vizinhos_adjacentes",
            {"lote_id_param": lote_id},
        ).execute()

        dados_vizinhos = rpc_response.data or []

        vizinhos: List[Dict[str, Any]] = []
        vizinhos_por_direcao: Dict[str, List[Dict[str, Any]]] = {
            "norte": [],
            "sul": [],
            "leste": [],
            "oeste": [],
        }

        for linha in dados_vizinhos:
            azimute_graus = float(linha.get("azimute_graus") or 0.0)
            direcao = _direcao_por_azimute(azimute_graus)

            numero_vizinho = linha.get("vizinho_numero")
            if numero_vizinho is None:
                numero_vizinho = linha.get("vizinho_id")
            try:
                numero_vizinho = int(numero_vizinho)
            except (TypeError, ValueError):
                numero_vizinho = 0

            cliente_nome = linha.get("cliente_nome")
            cliente_cpf = linha.get("cliente_cpf")
            cliente = None
            if cliente_nome:
                cliente = {"nome": cliente_nome, "cpf": cliente_cpf}

            vizinho = {
                "lote_id": str(linha.get("vizinho_id")),
                "numero": numero_vizinho,
                "direcao": direcao,
                "cliente": cliente,
                "azimute_graus": azimute_graus,
                "distancia_metros": float(linha.get("distancia_metros") or 0.0),
            }

            vizinhos.append(vizinho)
            vizinhos_por_direcao[direcao].append(vizinho)

        elapsed_ms = round((perf_counter() - started_at) * 1000, 2)

        return {
            "success": True,
            "lote_id": str(lote_id),
            "vizinhos": vizinhos,
            "vizinhos_por_direcao": vizinhos_por_direcao,
            "total_vizinhos": len(vizinhos),
            "metadados": {
                "algoritmo": "postgis_st_touches_st_azimuth",
                "lotes_processados": 1,
                "tempo_execucao_ms": elapsed_ms,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Confrontações ──

@router.post("/{lote_id}/salvar-confrontacoes")
async def salvar_confrontacoes(
    lote_id: int,
    body: SalvarConfrontacoesInput,
    perfil: dict = Depends(require_topografo),
) -> Dict[str, Any]:
    """
    Salva confrontações APÓS revisão do topógrafo.
    Estratégia: delete prévio + insert (snapshot idempotente).
    """
    try:
        _lote_autorizado(lote_id, perfil, escrita=True)

        direcoes_validas = {"norte", "sul", "leste", "oeste"}
        confrontacoes_por_direcao: Dict[str, Dict[str, Any]] = {}

        for vizinho in body.vizinhos:
            direcao = (vizinho.direcao or "").strip().lower()
            if direcao not in direcoes_validas:
                raise HTTPException(
                    status_code=400, detail=f"Direção inválida: {vizinho.direcao}"
                )

            # 1 confrontação por direção (idempotente)
            if direcao in confrontacoes_por_direcao:
                continue

            try:
                vizinho_lote_id = int(vizinho.lote_id)
            except (TypeError, ValueError):
                vizinho_lote_id = None

            confrontacoes_por_direcao[direcao] = {
                "lote_id": lote_id,
                "vizinho_lote_id": vizinho_lote_id,
                "numero_vizinho": vizinho.numero,
                "direcao": direcao,
                "tipo": "LOTE",
                "nome": f"Lote {vizinho.numero}",
            }

        # Upsert lógico: remove anteriores → insere snapshot atual
        supabase.table("confrontacoes").delete().eq("lote_id", lote_id).execute()

        registros = list(confrontacoes_por_direcao.values())
        if registros:
            supabase.table("confrontacoes").insert(registros).execute()

        return {
            "success": True,
            "lote_id": str(lote_id),
            "total_salvas": len(registros),
            "direcoes_salvas": sorted(confrontacoes_por_direcao.keys()),
            "message": "Confrontações salvas com sucesso",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{lote_id}/confrontacoes")
async def listar_confrontacoes(
    lote_id: int, perfil: dict = Depends(get_perfil)
) -> Dict[str, Any]:
    """Busca confrontações salvas de um lote."""
    try:
        _lote_autorizado(lote_id, perfil, escrita=False)

        response = (
            supabase.table("confrontacoes")
            .select("vizinho_lote_id, numero_vizinho, direcao, nome, cpf")
            .eq("lote_id", lote_id)
            .order("direcao")
            .execute()
        )

        linhas = response.data or []
        vizinhos: List[Dict[str, Any]] = []
        vizinhos_por_direcao: Dict[str, List[Dict[str, Any]]] = {
            "norte": [],
            "sul": [],
            "leste": [],
            "oeste": [],
        }

        for linha in linhas:
            direcao = str(linha.get("direcao") or "").lower()
            if direcao not in vizinhos_por_direcao:
                continue

            numero_vizinho = linha.get("numero_vizinho")
            try:
                numero_vizinho = int(numero_vizinho)
            except (TypeError, ValueError):
                numero_vizinho = 0

            cliente_nome = linha.get("nome")
            cliente_cpf = linha.get("cpf")
            cliente = None
            if cliente_nome:
                cliente = {"nome": cliente_nome, "cpf": cliente_cpf}

            vizinho = {
                "lote_id": str(linha.get("vizinho_lote_id") or ""),
                "numero": numero_vizinho,
                "direcao": direcao,
                "cliente": cliente,
            }

            vizinhos.append(vizinho)
            vizinhos_por_direcao[direcao].append(vizinho)

        return {
            "success": True,
            "lote_id": str(lote_id),
            "vizinhos": vizinhos,
            "vizinhos_por_direcao": vizinhos_por_direcao,
            "total_vizinhos": len(vizinhos),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Sobreposições por lote ──

@router.get("/{lote_id}/sobreposicoes")
async def detectar_sobreposicoes(
    lote_id: int, perfil: dict = Depends(get_perfil)
):
    """Detecta sobreposições de um lote com outros."""
    try:
        _lote_autorizado(lote_id, perfil, escrita=False)
        response = supabase.rpc(
            "detectar_sobreposicoes", {"p_lote_id": lote_id}
        ).execute()
        return response.data or []
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Validação Topologia ──

@router.post("/{lote_id}/validar-topologia")
async def validar_topologia(
    lote_id: int,
    body: Optional[ValidarTopologiaInput] = None,
    perfil: dict = Depends(get_perfil),
):
    """Valida topologia do lote (geometria válida, sem sobreposição, etc)."""
    try:
        _lote_autorizado(lote_id, perfil, escrita=False)
        geom_wkt = body.geom_wkt if body and body.geom_wkt else None
        response = supabase.rpc(
            "validar_topologia_sql", {"p_lote_id": lote_id, "p_geom_wkt": geom_wkt}
        ).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Erro ao validar topologia")
        return response.data[0] if isinstance(response.data, list) else response.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Vizinhos manuais (projeto individual) ──

@router.post("/{lote_id}/vizinhos")
async def adicionar_vizinho(
    lote_id: int, vizinho: VizinhoInput, perfil: dict = Depends(require_topografo)
):
    """Adiciona vizinho manualmente (projeto individual)."""
    try:
        _lote_autorizado(lote_id, perfil, escrita=True)
        data = {
            "lote_id": lote_id,
            "nome_vizinho": vizinho.nome_vizinho,
            "lado": vizinho.lado,
        }
        response = supabase.table("vizinhos").insert(data).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{lote_id}/vizinhos")
async def listar_vizinhos(lote_id: int, perfil: dict = Depends(get_perfil)):
    """Lista vizinhos manuais de um lote."""
    try:
        _lote_autorizado(lote_id, perfil, escrita=False)
        response = (
            supabase.table("vizinhos").select("*").eq("lote_id", lote_id).execute()
        )
        return response.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
