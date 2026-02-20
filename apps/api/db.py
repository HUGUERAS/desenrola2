"""Cliente Supabase compartilhado."""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL", "")
key = os.getenv("SUPABASE_SERVICE_KEY", "") or os.getenv("SUPABASE_KEY", "")

if not url or not key:
    raise RuntimeError(
        "SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios. Configure o arquivo .env."
    )

try:
    supabase: Client = create_client(url, key)
except Exception as e:
    raise RuntimeError(f"Falha ao inicializar cliente Supabase: {e}") from e
