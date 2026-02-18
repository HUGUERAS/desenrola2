"""
Service: Topology — Identificação de Vizinhos
⚠️ PROCESSA 1 LOTE POR VEZ (não todos juntos!)
✅ Usa PostGIS ST_Touches + índice GIST.
✅ Calcula direção cardeal via azimute.
"""
from typing import Dict, List
from database import supabase


class TopologyService:
    """Serviço de topologia para identificação de vizinhos."""

    async def identificar_vizinhos_lote(self, lote_id: int) -> Dict:
        """
        Identifica vizinhos de UM lote específico.
        ⚠️ NÃO processa todos os lotes de uma vez!

        Performance: 1 lote × ~4 vizinhos = <1 segundo ⚡
        """

        # 1. Buscar geometria do lote
        lote_response = supabase.table("lotes") \
            .select("id, numero, geom, projeto_id") \
            .eq("id", lote_id) \
            .single() \
            .execute()

        if not lote_response.data:
            raise ValueError("Lote não encontrado")

        lote = lote_response.data

        # 2. Buscar APENAS lotes adjacentes (PostGIS via RPC)
        viz_response = supabase.rpc("buscar_vizinhos_adjacentes", {
            "lote_id_param": lote_id
        }).execute()

        # 3. Processar cada vizinho e agrupar por direção
        vizinhos: List[Dict] = []
        vizinhos_por_direcao: Dict[str, List[Dict]] = {}

        for viz in (viz_response.data or []):
            direcao = viz.get("direcao", "desconhecido")

            vizinho_data = {
                "lote_id": viz.get("id"),
                "numero": viz.get("numero"),
                "direcao": direcao,
                "cliente_nome": viz.get("cliente_nome", "Sem cliente"),
                "cliente_cpf": viz.get("cliente_cpf")
            }

            vizinhos.append(vizinho_data)

            if direcao not in vizinhos_por_direcao:
                vizinhos_por_direcao[direcao] = []
            vizinhos_por_direcao[direcao].append(vizinho_data)

        return {
            "success": True,
            "lote_atual": lote["numero"],
            "vizinhos": vizinhos,
            "vizinhos_por_direcao": vizinhos_por_direcao,
            "total_vizinhos": len(vizinhos)
        }


# Singleton
topology_service = TopologyService()
