"""
Desenrola API — FastAPI Application
✅ Porta: 8010
✅ RBAC: auth.py (get_perfil, require_topografo)
✅ Geometria: GeoJSON ↔ WKT SRID=4674 (SIRGAS 2000)
✅ Multitenant: tenant_id
"""
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from auth import get_perfil
from db import supabase
from models.schemas import PerfilSetInput

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
    allow_credentials=True,
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

        # Mapear role conforme ontem
        primary_role = "GESTOR" if role == "topografo" else "CLIENTE"
        data = {"id": perfil["user_id"], "primary_role": primary_role}
        response = supabase.table("profiles").upsert(data, on_conflict="id").execute()
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
            supabase.table("properties").select("*").eq("token_acesso", token).execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Link inválido ou expirado")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Run ──

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
