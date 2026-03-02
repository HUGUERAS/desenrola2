"""Router público para portal do confrontante (token)."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from db import supabase

router = APIRouter(prefix="/api/acesso-confrontante", tags=["Confrontante"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024


class ConfrontanteSalvarInput(BaseModel):
    nome: Optional[str] = None
    cpf: Optional[str] = None
    imovel: Optional[str] = None
    matricula: Optional[str] = None
    whatsapp: Optional[str] = None
    observacoes: Optional[str] = None
    status: Optional[str] = "awaiting_response"


def _get_confrontacao_por_token(token: str):
    response = (
        supabase.table("confrontacoes")
        .select("*")
        .eq("token_acesso", token)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Token inválido")
    return response.data[0]


@router.get("")
async def get_acesso_confrontante(token: str):
    """Retorna dados públicos do confrontante via token."""
    try:
        confrontacao = _get_confrontacao_por_token(token)

        lote = (
            supabase.table("lotes")
            .select("id, projeto_id, nome_cliente, denominacao_imovel, matricula_imovel, municipio, uf")
            .eq("id", confrontacao["lote_id"])
            .limit(1)
            .execute()
        )
        lote_data = lote.data[0] if lote.data else None

        projeto_data = None
        if lote_data and lote_data.get("projeto_id"):
            projeto = (
                supabase.table("projetos")
                .select("id, nome, cidade, estado")
                .eq("id", lote_data["projeto_id"])
                .limit(1)
                .execute()
            )
            projeto_data = projeto.data[0] if projeto.data else None

        return {
            **confrontacao,
            "lote": lote_data,
            "projeto": projeto_data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/salvar")
async def salvar_acesso_confrontante(token: str, body: ConfrontanteSalvarInput):
    """Atualiza dados do confrontante e marca contato em andamento."""
    try:
        confrontacao = _get_confrontacao_por_token(token)

        payload = {k: v for k, v in body.model_dump().items() if v is not None}
        if "status" not in payload:
            payload["status"] = "awaiting_response"
        payload["data_contato"] = datetime.now(timezone.utc).isoformat()

        updated = (
            supabase.table("confrontacoes")
            .update(payload)
            .eq("id", confrontacao["id"])
            .select("*")
            .limit(1)
            .execute()
        )
        return {"ok": True, "confrontacao": updated.data[0] if updated.data else None}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/upload")
async def upload_documento_confrontante(
    token: str,
    tipo: str = Form("anuencia"),
    arquivo: UploadFile = File(...),
):
    """Upload de documentos do confrontante para Supabase Storage."""
    try:
        confrontacao = _get_confrontacao_por_token(token)

        nome_original = arquivo.filename or "documento"
        extensao = Path(nome_original).suffix.lower()
        if extensao and extensao not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Formato de arquivo não permitido")

        file_bytes = await arquivo.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Arquivo vazio")
        if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="Arquivo excede 10MB")

        nome_seguro = re.sub(r"[^a-zA-Z0-9._-]", "_", nome_original).replace("..", "_")
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
        storage_path = f"confrontante/{token}/{ts}_{nome_seguro}"

        supabase.storage.from_("documentos").upload(
            storage_path,
            file_bytes,
            {"content-type": arquivo.content_type or "application/octet-stream", "upsert": "false"},
        )

        public_url = supabase.storage.from_("documentos").get_public_url(storage_path)
        documento_payload = {
            "lote_id": confrontacao["lote_id"],
            "confrontante_id": confrontacao["id"],
            "tipo": tipo,
            "formato": extensao.replace(".", "") if extensao else None,
            "arquivo_url": public_url,
            "nome_arquivo": nome_original,
        }

        try:
            documento = (
                supabase.table("documentos")
                .insert(documento_payload)
                .select("*")
                .limit(1)
                .execute()
            )
        except Exception:
            documento_payload.pop("confrontante_id", None)
            documento = (
                supabase.table("documentos")
                .insert(documento_payload)
                .select("*")
                .limit(1)
                .execute()
            )

        supabase.table("confrontacoes").update(
            {
                "status": "docs_received",
                "data_docs_recebidos": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", confrontacao["id"]).execute()

        return {
            "ok": True,
            "documento": documento.data[0] if documento.data else None,
            "arquivo_url": public_url,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
