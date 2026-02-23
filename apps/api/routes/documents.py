"""
Router: Documentos — Geração e listagem.
Padrao: lote_id (com fallback property_id legado)
"""
import json
import re
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from auth import get_perfil, require_topografo
from services.documents import (
    gerar_memorial_texto,
    get_documento_by_id,
    get_confrontacoes_by_lote,
    get_lote_by_id,
    list_documentos_by_lote,
    save_document_record,
    update_document_url,
)

router = APIRouter(prefix="/api/documents", tags=["Documentos"])
UPLOAD_ROOT = Path("uploads/documents")
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}

@router.post("/gerar/{lote_id}")
def gerar_documento(lote_id: str, perfil: dict = Depends(require_topografo)):
    """Gera um documento para o lote (Ex: Memorial). Apenas topógrafos."""
    try:
        lote = get_lote_by_id(lote_id)
        if not lote:
            raise HTTPException(status_code=404, detail="Lote não encontrado")

        vizinhos = get_confrontacoes_by_lote(lote_id)

        conteudo = gerar_memorial_texto(lote, vizinhos)
        fake_url = f"https://api.desenrola.com/docs/{lote_id}/{datetime.now().timestamp()}.txt"

        doc = save_document_record(lote_id, "memorial", fake_url, conteudo)
        return doc

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{lote_id}")
def listar_documentos(lote_id: str, perfil: dict = Depends(get_perfil)):
    """Lista documentos de um lote."""
    try:
        return list_documentos_by_lote(lote_id)
    except Exception as e:
        err_str = str(e)
        # PGRST205: table doesn't exist yet — return empty list gracefully
        if "PGRST205" in err_str or "documentos" in err_str:
            return []
        raise HTTPException(status_code=500, detail=err_str)


@router.post("/upload/{lote_id}")
async def upload_documento(
    lote_id: str,
    tipo: str = Form(...),
    arquivo: UploadFile = File(...),
    perfil: dict = Depends(get_perfil),
):
    """Upload de documento do cliente/topógrafo para o lote."""
    try:
        if not tipo.strip():
            raise HTTPException(status_code=400, detail="Tipo do documento é obrigatório")

        nome_original = arquivo.filename or "documento"
        extensao = Path(nome_original).suffix.lower()
        if extensao and extensao not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Formato de arquivo não permitido")

        conteudo = await arquivo.read()
        if not conteudo:
            raise HTTPException(status_code=400, detail="Arquivo vazio")
        if len(conteudo) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Arquivo excede 10MB")

        pasta_lote = UPLOAD_ROOT / str(lote_id)
        pasta_lote.mkdir(parents=True, exist_ok=True)
        nome_base = re.sub(r"[^a-zA-Z0-9._-]", "_", nome_original)
        nome_arquivo = f"{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{nome_base}"
        caminho = pasta_lote / nome_arquivo
        caminho.write_bytes(conteudo)

        meta = {
            "kind": "local_file",
            "path": str(caminho.resolve()),
            "filename": nome_original,
            "content_type": arquivo.content_type or "application/octet-stream",
        }
        doc = save_document_record(
            lote_id,
            f"upload_{tipo.strip().lower()}",
            "",
            json.dumps(meta, ensure_ascii=True),
        )
        if not doc or "id" not in doc:
            raise HTTPException(status_code=500, detail="Falha ao salvar metadados do documento")

        download_url = f"/api/documents/download/{doc['id']}"
        update_document_url(str(doc["id"]), download_url)
        doc["arquivo_url"] = download_url
        doc["nome_arquivo"] = nome_original
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{doc_id}")
def baixar_documento(doc_id: str, perfil: dict = Depends(get_perfil)):
    """Download de documento enviado."""
    try:
        doc = get_documento_by_id(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Documento não encontrado")

        conteudo = doc.get("conteudo")
        if not conteudo:
            raise HTTPException(status_code=404, detail="Conteúdo do documento indisponível")

        try:
            meta = json.loads(conteudo)
        except Exception:
            meta = None

        if not isinstance(meta, dict) or meta.get("kind") != "local_file":
            raise HTTPException(status_code=400, detail="Documento não possui arquivo físico")

        caminho = Path(str(meta.get("path", "")))
        if not caminho.exists():
            raise HTTPException(status_code=404, detail="Arquivo não encontrado no servidor")

        return FileResponse(
            path=caminho,
            filename=str(meta.get("filename") or caminho.name),
            media_type=str(meta.get("content_type") or "application/octet-stream"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
