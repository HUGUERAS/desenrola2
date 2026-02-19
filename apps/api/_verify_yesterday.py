import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = "https://ccpxoofxenmqzywsrvaa.supabase.co"
key = "sb_secret_TcJj1-7Xl7UaY3Ofva5lhQ_Q_sXRI9Z"

try:
    sb = create_client(url, key)
    # Tenta listar tabelas
    res = sb.table("profiles").select("count").execute()
    print("Conexão OK!")
    print(res.data)
except Exception as e:
    print("Erro na conexão:", e)
