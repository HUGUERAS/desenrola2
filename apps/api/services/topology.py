"""
Service: Topology — Identificação de Vizinhos
⚠️ PROCESSA 1 LOTE POR VEZ (não todos juntos!)
✅ Usa PostGIS ST_Touches + índice GIST.
✅ Mapeamento: lotes → properties (Supabase)
"""
from typing import Dict, List
from db import supabase


class TopologyService:
    """Serviço de topologia para identificação de vizinhos."""

    async def identificar_vizinhos(self, property_id: str) -> Dict:
        """
        Identifica vizinhos de UM lote (property) específico.
        ⚠️ NÃO processa todos de uma vez!
        """
        # 1. Buscar geometria da property
        prop_response = supabase.table("properties") \
            .select("id, name, geom, owner_id") \
            .eq("id", property_id) \
            .execute()

        if not prop_response.data:
            raise ValueError("Lote não encontrado")

        prop = prop_response.data[0]

        # 2. Buscar adjacentes via PostGIS RPC (se existir)
        vizinhos: List[Dict] = []
        vizinhos_por_direcao: Dict[str, List[Dict]] = {}

        try:
            viz_response = supabase.rpc("buscar_vizinhos_adjacentes", {
                "lote_id_param": property_id
            }).execute()

            for viz in (viz_response.data or []):
                direcao = viz.get("direcao", "desconhecido")
                vizinho_data = {
                    "lote_id": viz.get("id"),
                    "nome": viz.get("name") or viz.get("cliente_nome", "Sem cliente"),
                    "direcao": direcao,
                }
                vizinhos.append(vizinho_data)
                if direcao not in vizinhos_por_direcao:
                    vizinhos_por_direcao[direcao] = []
                vizinhos_por_direcao[direcao].append(vizinho_data)
        except Exception:
            # RPC pode não existir ainda — retorna lista vazia
            pass

        return {
            "success": True,
            "lote_id": property_id,
            "nome": prop.get("name"),
            "vizinhos": vizinhos,
            "vizinhos_por_direcao": vizinhos_por_direcao,
            "total_vizinhos": len(vizinhos),
        }


# Singleton
topology_service = TopologyService()
