"""Serviço de geração de documentos."""
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


def save_document_record(property_id: str, tipo: str, url: str, conteudo: str = None):
    """Salva registro do documento no Supabase."""
    data = {
        "property_id": property_id,
        "tipo": tipo,
        "arquivo_url": url,
        "conteudo": conteudo,
    }
    response = supabase.table("documentos").insert(data).execute()
    return response.data[0] if response.data else {"ok": True}
