"""RBAC e Multitenant: validação com Supabase."""
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os
import httpx
from dotenv import load_dotenv
from db import supabase

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "") or os.getenv("SUPABASE_KEY", "")

security = HTTPBearer(auto_error=False)

async def get_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[str]:
    if credentials: return credentials.credentials
    return None

async def get_current_user(token: Optional[str] = Depends(get_token)):
    if not token: return None
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_SERVICE_KEY},
                timeout=15.0
            )
        if response.status_code != 200: return None
        user_data = response.json()
        return {"user_id": user_data.get("id"), "email": user_data.get("email")}
    except Exception: return None

async def get_current_user_required(user: Optional[dict] = Depends(get_current_user)):
    if not user: raise HTTPException(status_code=401, detail="Token inválido")
    return user

async def get_perfil(user: dict = Depends(get_current_user_required)):
    """Busca perfil na tabela 'perfis' (Projeto Agora Sim)."""
    # No projeto Agora Sim, a tabela é 'perfis' e a coluna de busca é 'user_id'
    res = supabase.table("perfis").select("*").eq("user_id", user["user_id"]).execute()
    if not res.data:
        # Se não tiver perfil, retorna um mock para não bloquear o login
        return {"user_id": user["user_id"], "email": user["email"], "role": "proprietario"}
    
    profile = res.data[0]
    return {**profile, "user_id": user["user_id"]}

async def require_topografo(perfil: dict = Depends(get_perfil)):
    if perfil.get("role") != "topografo":
        raise HTTPException(status_code=403, detail="Acesso restrito a topógrafos")
    return perfil
