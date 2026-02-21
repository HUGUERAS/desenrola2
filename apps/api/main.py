"""
Desenrola API — FastAPI Application
✅ Porta: 8010
✅ RBAC: auth.py (get_perfil, require_topografo)
✅ Geometria: GeoJSON ↔ WKT SRID=4674 (SIRGAS 2000)
✅ Multitenant: tenant_id
"""
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from config import settings
from auth import get_perfil
from db import supabase
from models.schemas import PerfilSetInput


# ── Modelos para acesso público via magic link ──

class VizinhoPorSegmento(BaseModel):
    segmento_index: int
    confrontante_tipo: str = "FAZENDA"  # FAZENDA, ESTRADA, CORREGO, AREA_PUBLICA, OUTRO
    nome: Optional[str] = None
    cpf: Optional[str] = None
    imovel: Optional[str] = None
    matricula: Optional[str] = None


class AcessoLoteSalvar(BaseModel):
    nome_cliente: Optional[str] = None
    cpf_cnpj_cliente: Optional[str] = None
    telefone_cliente: Optional[str] = None
    email_cliente: Optional[str] = None
    rg_cliente: Optional[str] = None
    estado_civil_cliente: Optional[str] = None
    municipio: Optional[str] = None
    uf: Optional[str] = None
    comarca: Optional[str] = None
    codigo_sigef: Optional[str] = None
    denominacao_imovel: Optional[str] = None
    matricula_imovel: Optional[str] = None
    geojson: Optional[Dict[str, Any]] = None
    vizinhos: Optional[List[VizinhoPorSegmento]] = []

from routes.projetos import router as projetos_router
from routes.lotes import router as lotes_router
from routes.financeiro import router as financeiro_router
from routes.documents import router as documents_router
from routes.topology import router as topology_router

app = FastAPI(
    title="Desenrola API",
    description="API para regularização fundiária — SPA com foco em mapa",
    version="1.0.0",
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials="*" not in settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──
app.include_router(projetos_router)
app.include_router(lotes_router)
app.include_router(financeiro_router)
app.include_router(documents_router)
app.include_router(topology_router)


# ── Health ──

@app.get("/api/health")
async def health():
    return {"status": "ok", "srid": settings.SRID, "port": settings.PORT}


# ── Perfil ──

@app.get("/api/perfis/me")
async def get_perfil_me(perfil: dict = Depends(get_perfil)):
    """Retorna perfil do usuário autenticado."""
    return perfil


@app.post("/api/perfis/set-role")
async def set_perfil_role(body: PerfilSetInput, perfil: dict = Depends(get_perfil)):
    """Define role do usuário (primeiro acesso)."""
    try:
        role = body.role
        if role not in ("topografo", "proprietario"):
            raise HTTPException(status_code=400, detail="Role inválida")

        # No projeto Desenrola, usamos a role diretamente ou mapeada
        data = {"user_id": perfil["user_id"], "role": role}
        
        # Extra fields for topografo
        if role == "topografo" and body.crea:
            data["crea"] = body.crea
            data["empresa"] = body.empresa or ""

        response = supabase.table("perfis").upsert(data, on_conflict="user_id").execute()
        return {"ok": True, "role": role}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Acesso lote por token (alias sem auth) ──

@app.get("/api/acesso-lote")
async def acesso_lote_token(token: str):
    """Acesso público por magic link."""
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


@app.post("/api/acesso-lote/salvar")
async def salvar_dados_cliente(token: str, body: AcessoLoteSalvar):
    """Salva dados preenchidos pelo cliente via magic link. Público, sem autenticação."""
    try:
        res = supabase.table("lotes").select("id").eq("token_acesso", token).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Link inválido ou expirado")

        lote_id = res.data[0]["id"]

        # Campos do lote a atualizar
        campos_lote = [
            "nome_cliente", "cpf_cnpj_cliente", "telefone_cliente", "email_cliente",
            "rg_cliente", "estado_civil_cliente", "municipio", "uf", "comarca",
            "codigo_sigef", "denominacao_imovel", "matricula_imovel",
        ]
        update_data: Dict[str, Any] = {}
        for campo in campos_lote:
            val = getattr(body, campo, None)
            if val is not None:
                update_data[campo] = val

        if body.geojson:
            update_data["geojson"] = body.geojson
            update_data["status"] = "VALIDACAO"
        else:
            update_data["status"] = "DESENHO"

        if update_data:
            supabase.table("lotes").update(update_data).eq("id", lote_id).execute()

        # Salvar vizinhos por segmento (apaga os anteriores por segmento)
        if body.vizinhos:
            supabase.table("confrontacoes").delete()\
                .eq("lote_id", lote_id)\
                .not_.is_("segmento_index", "null")\
                .execute()

            registros = []
            for v in body.vizinhos:
                registros.append({
                    "lote_id": lote_id,
                    "segmento_index": v.segmento_index,
                    "confrontante_tipo": v.confrontante_tipo,
                    "nome": v.nome,
                    "cpf": v.cpf,
                    "imovel": v.imovel,
                    "direcao": "segmento",
                })
            supabase.table("confrontacoes").insert(registros).execute()

        return {"ok": True, "lote_id": lote_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Run ──

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
