#!/usr/bin/env python3
"""
🧪 TOPOLOGY WIZARD: VALIDAÇÃO COMPLETA
Testa todas as funcionalidades do sistema de vizinhança
"""
import sys
import json
from time import perf_counter
from supabase import create_client, Client

# Credenciais
SUPABASE_URL = "https://xntxtdximacsdnldouxa.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudHh0ZHhpbWFjc2RubGRvdXhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk1OTkxOCwiZXhwIjoyMDg1NTM1OTE4fQ.aEGC44KAzlK6iECi5_0zukv1BX5gjFCl4UHjljopKRk"

API_BASE_URL = "http://127.0.0.1:8010/api"

def print_header(texto: str):
    """Imprime cabeçalho formatado"""
    print("\n" + "=" * 70)
    print(f"🔧 {texto}")
    print("=" * 70)

def print_step(numero: int, total: int, texto: str):
    """Imprime etapa"""
    print(f"\n[{numero}/{total}] {texto}")

def print_success(texto: str):
    """Imprime sucesso"""
    print(f"   ✅ {texto}")

def print_error(texto: str):
    """Imprime erro"""
    print(f"   ❌ {texto}")

def print_warning(texto: str):
    """Imprime aviso"""
    print(f"   ⚠️  {texto}")

def print_info(texto: str):
    """Imprime info"""
    print(f"   ℹ️  {texto}")

def teste_1_conexao_supabase(supabase: Client) -> bool:
    """Testa conexão com Supabase"""
    print_step(1, 6, "Testando conexão Supabase...")
    try:
        result = supabase.table('lotes').select('id').limit(1).execute()
        print_success("Conexão estabelecida")
        print_info(f"Testado com {len(result.data)} registro(s)")
        return True
    except Exception as e:
        print_error(f"Falha na conexão: {e}")
        return False

def teste_2_verificar_schema(supabase: Client) -> dict:
    """Verifica se schema está completo"""
    print_step(2, 6, "Verificando schema de topologia...")
    
    status = {
        'tabela_confrontacoes': False,
        'funcao_rpc': False,
        'indices': False
    }
    
    # Testa tabela confrontacoes
    try:
        supabase.table('confrontacoes').select('id').limit(1).execute()
        status['tabela_confrontacoes'] = True
        print_success("Tabela 'confrontacoes' existe")
    except Exception as e:
        print_error("Tabela 'confrontacoes' NÃO existe")
        print_info("Execute: database/init/topology-schema.sql no Dashboard")
    
    # Testa função RPC buscar_vizinhos_adjacentes
    try:
        # Tenta chamar com ID inválido para ver se função existe
        supabase.rpc('buscar_vizinhos_adjacentes', {'lote_id_param': -1}).execute()
        status['funcao_rpc'] = True
        print_success("Função RPC 'buscar_vizinhos_adjacentes' existe")
    except Exception as e:
        erro_msg = str(e).lower()
        if 'function' in erro_msg and 'does not exist' in erro_msg:
            print_error("Função RPC 'buscar_vizinhos_adjacentes' NÃO existe")
        elif 'not found' in erro_msg or 'sem geometria' in erro_msg:
            # Erro esperado (lote -1 não existe), mas função está OK
            status['funcao_rpc'] = True
            print_success("Função RPC 'buscar_vizinhos_adjacentes' existe")
        else:
            print_warning(f"Erro ao verificar função: {e}")
    
    return status

def teste_3_buscar_lote_teste(supabase: Client) -> int:
    """Busca um lote com geometria para testar"""
    print_step(3, 6, "Buscando lote de teste...")
    
    try:
        result = supabase.table('lotes').select('id,numero,geom,projeto_id').not_.is_('geom', 'null').limit(1).execute()
        
        if not result.data:
            print_warning("Nenhum lote com geometria encontrado")
            print_info("Crie lotes com geometrias primeiro")
            return None
        
        lote = result.data[0]
        print_success(f"Lote encontrado: ID={lote['id']}, Numero={lote.get('numero', 'N/A')}")
        return lote['id']
        
    except Exception as e:
        print_error(f"Erro ao buscar lote: {e}")
        return None

def teste_4_identificar_vizinhos(lote_id: int) -> dict:
    """Testa endpoint POST /identificar-vizinhos"""
    print_step(4, 6, f"Testando identificação de vizinhos (lote_id={lote_id})...")
    
    try:
        import requests
        
        inicio = perf_counter()
        response = requests.post(
            f"{API_BASE_URL}/lotes/{lote_id}/identificar-vizinhos",
            timeout=10
        )
        tempo_ms = (perf_counter() - inicio) * 1000
        
        if response.status_code == 200:
            data = response.json()
            num_vizinhos = len(data.get('vizinhos', []))
            print_success(f"Identificação OK em {tempo_ms:.0f}ms")
            print_info(f"Vizinhos encontrados: {num_vizinhos}")
            
            # Mostra por direção
            por_direcao = data.get('vizinhos_por_direcao', {})
            for direcao, vizinhos in por_direcao.items():
                print_info(f"  {direcao.upper()}: {len(vizinhos)} vizinho(s)")
            
            return data
        else:
            print_error(f"Status {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Erro na requisição: {e}")
        print_info("Certifique-se de que a API está rodando na porta 8010")
        return None

def teste_5_salvar_confrontacoes(lote_id: int, confrontacoes_detectadas: dict) -> bool:
    """Testa endpoint POST /salvar-confrontacoes"""
    print_step(5, 6, f"Testando salvamento de confrontações...")
    
    if not confrontacoes_detectadas:
        print_warning("Pulando (sem confrontações para salvar)")
        return False
    
    try:
        import requests
        
        # Prepara payload baseado nas confrontações detectadas
        payload = {
            "confrontacoes": []
        }
        
        for vizinho in confrontacoes_detectadas.get('vizinhos', [])[:4]:  # Máximo 4 direções
            payload["confrontacoes"].append({
                "direcao": vizinho.get('direcao', 'norte'),
                "numero_vizinho": vizinho.get('numero'),
                "tipo": "LOTE",
                "nome": vizinho.get('cliente_nome'),
                "cpf": vizinho.get('cliente_cpf')
            })
        
        print_info(f"Salvando {len(payload['confrontacoes'])} confrontação(ões)")
        
        response = requests.post(
            f"{API_BASE_URL}/lotes/{lote_id}/salvar-confrontacoes",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Salvamento OK: {data.get('total_salvo')} registros")
            return True
        else:
            print_error(f"Status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Erro na requisição: {e}")
        return False

def teste_6_listar_confrontacoes(lote_id: int) -> bool:
    """Testa endpoint GET /confrontacoes"""
    print_step(6, 6, f"Testando listagem de confrontações salvas...")
    
    try:
        import requests
        
        response = requests.get(
            f"{API_BASE_URL}/lotes/{lote_id}/confrontacoes",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            total = data.get('total', 0)
            print_success(f"Listagem OK: {total} confrontação(ões) salva(s)")
            
            # Mostra detalhes
            for confrontacao in data.get('confrontacoes', []):
                direcao = confrontacao.get('direcao', 'N/A')
                numero = confrontacao.get('numero_vizinho', 'N/A')
                print_info(f"  {direcao.upper()}: Lote {numero}")
            
            return True
        else:
            print_error(f"Status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Erro na requisição: {e}")
        return False

def main():
    print_header("VALIDAÇÃO COMPLETA - TOPOLOGY WIZARD")
    
    try:
        # Conecta ao Supabase
        supabase = create_client(SUPABASE_URL, SERVICE_KEY)
        
        # Testes
        resultados = {
            'conexao': False,
            'schema': {},
            'lote_teste': None,
            'identificar': None,
            'salvar': False,
            'listar': False
        }
        
        # 1. Conexão
        resultados['conexao'] = teste_1_conexao_supabase(supabase)
        if not resultados['conexao']:
            print_error("\n❌ Falha crítica: sem conexão com Supabase")
            return 1
        
        # 2. Schema
        resultados['schema'] = teste_2_verificar_schema(supabase)
        schema_ok = all(resultados['schema'].values())
        
        if not schema_ok:
            print_warning("\n⚠️  Schema incompleto - execute topology-schema.sql")
            print_info("Dashboard: https://supabase.com/dashboard/project/xntxtdximacsdnldouxa/sql/new")
            return 1
        
        # 3. Lote de teste
        resultados['lote_teste'] = teste_3_buscar_lote_teste(supabase)
        if not resultados['lote_teste']:
            print_warning("\n⚠️  Sem lotes para testar (crie geometrias primeiro)")
            return 1
        
        lote_id = resultados['lote_teste']
        
        # 4. Identificar vizinhos
        resultados['identificar'] = teste_4_identificar_vizinhos(lote_id)
        
        # 5. Salvar confrontações
        if resultados['identificar']:
            resultados['salvar'] = teste_5_salvar_confrontacoes(lote_id, resultados['identificar'])
        
        # 6. Listar confrontações
        if resultados['salvar']:
            resultados['listar'] = teste_6_listar_confrontacoes(lote_id)
        
        # Resumo final
        print_header("RESUMO")
        
        testes_ok = sum([
            resultados['conexao'],
            schema_ok,
            resultados['lote_teste'] is not None,
            resultados['identificar'] is not None,
            resultados['salvar'],
            resultados['listar']
        ])
        
        print(f"\n✅ Testes bem-sucedidos: {testes_ok}/6")
        
        if testes_ok == 6:
            print("\n🎉 TOPOLOGY WIZARD FUNCIONANDO 100%!")
            print("\nComponentes validados:")
            print("  ✅ Conexão Supabase")
            print("  ✅ Schema de topologia completo")
            print("  ✅ Função RPC buscar_vizinhos_adjacentes()")
            print("  ✅ POST /identificar-vizinhos")
            print("  ✅ POST /salvar-confrontacoes")
            print("  ✅ GET /confrontacoes")
            return 0
        else:
            print(f"\n⚠️  {6 - testes_ok} teste(s) falharam - verifique logs acima")
            return 1
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrompido pelo usuário")
        return 130
    except Exception as e:
        print(f"\n❌ ERRO FATAL: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
