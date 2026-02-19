"""Serviço de geração de documentos."""
from datetime import datetime
from db import supabase


def gerar_memorial_texto(lote: dict, vizinhos: list) -> str:
    """Gera o texto do Memorial Descritivo."""
    texto = "MEMORIAL DESCRITIVO\n\n"
    texto += f"IMÓVEL: {lote.get('name', 'Não informado')}\n"
    texto += f"PROPRIETÁRIO: {lote.get('name', 'Não informado')}\n"
    texto += f"CPF: {lote.get('cpf_cnpj', 'Não informado')}\n"
    texto += f"MUNICÍPIO: {lote.get('municipality', 'Não informado')}\n\n"
    
    texto += "DESCRIÇÃO DAS DIVISAS:\n"
    
    for vizinho in vizinhos:
        direcao = vizinho.get("direcao", "?").upper()
        nome = vizinho.get("nome", "Desconhecido")
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
