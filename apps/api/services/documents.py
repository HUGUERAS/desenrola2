from datetime import datetime
from db import supabase

def gerar_memorial_texto(lote: dict, vizinhos: list) -> str:
    """
    Gera o texto do Memorial Descritivo baseado nos dados do lote e vizinhos.
    Por enquanto retorna texto puro, futuramente PDF.
    """
    texto = f"MEMORIAL DESCRITIVO\n\n"
    texto += f"IMÓVEL: Lote {lote.get('numero', '?')}\n"
    texto += f"PROPRIETÁRIO: {lote.get('nome_cliente', 'Não informado')}\n"
    texto += f"CPF: {lote.get('cpf_cnpj_cliente', 'Não informado')}\n"
    texto += f"ÁREA: {lote.get('area', 0):.2f} m²\n"
    texto += f"PERÍMETRO: {lote.get('perimetro', 0):.2f} m\n\n"
    
    texto += "DESCRIÇÃO DAS DIVISAS:\n"
    
    # Exemplo simples de descrição baseada em vizinhos (confrontações)
    # Num cenário real, isso viria da topologia processada
    for vizinho in vizinhos:
        direcao = vizinho.get("direcao", "?").upper()
        nome = vizinho.get("nome", "Desconhecido")
        texto += f"- Ao {direcao}: confronta com {nome}.\n"
        
    texto += f"\nData: {datetime.now().strftime('%d/%m/%Y')}\n"
    return texto

def save_document_record(lote_id: int, tipo: str, url: str):
    """Salva registro do documento no Supabase."""
    data = {
        "lote_id": lote_id,
        "tipo": tipo,
        "formato": "text/plain", # Por enquanto texto
        "arquivo_url": url
    }
    response = supabase.table("documentos").insert(data).execute()
    return response.data[0]
