"""RBAC e Multitenant: validação JWT e filtros por tenant."""

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
import os

JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SUPABASE_JWT_SECRET")
ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)


async def get_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[str]:
    """Extrai o token Bearer do header."""
    if credentials:
        return credentials.credentials
    return None


async def get_current_user(token: Optional[str] = Depends(get_token)):
    """Decodifica o JWT e retorna user_id e email. Retorna None se não autenticado."""
    if not token:
        return None
    
    # Validação via API Supabase (mais robusto que decodificar localmente sem o segredo)
    try:
        from db import supabase
        user_response = supabase.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return None
            
        user = user_response.user
        return {"user_id": user.id, "email": user.email}
    except Exception as e:
        print(f"Auth error: {str(e)}")
        return None


async def get_current_user_required(user: Optional[dict] = Depends(get_current_user)):
    """Exige autenticação. Levanta 401 se não autenticado."""
    if not user:
        raise HTTPException(status_code=401, detail="Token inválido ou ausente")
    return user


async def get_perfil(
    user: dict = Depends(get_current_user_required), request: Request = None
):
    """Obtém perfil (role + tenant_id) do usuário no banco. Requer auth."""
    from db import supabase

    try:
        r = (
            supabase.table("perfis")
            .select("role")
            .eq("user_id", user["user_id"])
            .execute()
        )
        if r.data and len(r.data) > 0:
            role = r.data[0].get("role", "proprietario")
        else:
            role = "proprietario"
        return {
            **user,
            "role": role,
            "tenant_id": user["user_id"] if role == "topografo" else None,
        }
    except Exception:
        raise HTTPException(status_code=500, detail="Erro ao obter perfil")


async def require_topografo(perfil: dict = Depends(get_perfil)):
    """Exige perfil Topógrafo. Levanta 403 para Proprietário."""
    if perfil.get("role") != "topografo":
        raise HTTPException(status_code=403, detail="Acesso restrito a Topógrafo")
    return perfil


async def get_perfil_optional(user: Optional[dict] = Depends(get_current_user)):
    """Perfil opcional: retorna None se não autenticado."""
    if not user:
        return None
    try:
        from db import supabase

        r = (
            supabase.table("perfis")
            .select("role")
            .eq("user_id", user["user_id"])
            .execute()
        )
        role = r.data[0].get("role", "proprietario") if r.data else "proprietario"
        return {
            **user,
            "role": role,
            "tenant_id": user["user_id"] if role == "topografo" else None,
        }
    except Exception:
        return {**user, "role": "proprietario", "tenant_id": None}
