"""
Configuração do cliente Supabase para o backend.
✅ Usa variáveis de ambiente (sem hardcode).
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️ SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
