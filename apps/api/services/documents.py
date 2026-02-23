"""Servico de documentos."""
from datetime import datetime
from db import supabase


def gerar_memorial_texto(lote: dict, vizinhos: list) -> str:
    """Gera o texto do Memorial Descritivo."""
    texto = "MEMORIAL DESCRITIVO\n\n"
    texto += f"IMÓVEL: {lote.get('nome_cliente', 'Não informado')}\n"
    texto += f"PROPRIETÁRIO: {lote.get('nome_cliente', 'Não informado')}\n"
    texto += f"CPF/CNPJ: {lote.get('cpf_cnpj_cliente', 'Não informado')}\n"
    texto += f"EMAIL: {lote.get('email_cliente', 'Não informado')}\n\n"

    texto += "DESCRIÇÃO DAS DIVISAS:\n"

    for vizinho in vizinhos:
        direcao = (vizinho.get("lado") or vizinho.get("direcao", "?")).upper()
        nome = vizinho.get("nome_vizinho") or vizinho.get("nome", "Desconhecido")
        texto += f"- Ao {direcao}: confronta com {nome}.\n"

    texto += f"\nData: {datetime.now().strftime('%d/%m/%Y')}\n"
    return texto


def get_lote_by_id(lote_id: str) -> dict | None:
    response = supabase.table("lotes").select("*").eq("id", lote_id).execute()
    if not response.data:
        return None
    return response.data[0]


def get_confrontacoes_by_lote(lote_id: str) -> list[dict]:
    response = supabase.table("confrontacoes").select("*").eq("lote_id", lote_id).execute()
    return response.data or []


def save_document_record(lote_id: str, tipo: str, url: str, conteudo: str = None):
    """Salva registro do documento no Supabase (lote_id canônico + legacy)."""
    data = {
        "lote_id": lote_id,
        "property_id": lote_id,  # compatibilidade com schema legado
        "tipo": tipo,
        "arquivo_url": url,
        "conteudo": conteudo,
    }
    response = supabase.table("documentos").insert(data).execute()
    return response.data[0] if response.data else {"ok": True}


def get_documento_by_id(doc_id: str) -> dict | None:
    response = supabase.table("documentos").select("*").eq("id", doc_id).execute()
    if not response.data:
        return None
    return response.data[0]


def update_document_url(doc_id: str, url: str):
    supabase.table("documentos").update({"arquivo_url": url}).eq("id", doc_id).execute()


def list_documentos_by_lote(lote_id: str) -> list[dict]:
    """Lista documentos por lote com fallback para coluna legacy."""
    try:
        response = supabase.table("documentos").select("*").eq("lote_id", lote_id).execute()
        return response.data or []
    except Exception:
        response = supabase.table("documentos").select("*").eq("property_id", lote_id).execute()
        return response.data or []
