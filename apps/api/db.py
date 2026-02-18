"""Cliente Supabase compartilhado."""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

try:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    print(f"[DEBUG] DB Init - URL: {url}, Key Len: {len(key) if key else 0}, Key Start: {key[:5] if key else 'None'}")
    
    if not url or not key:
        print("[WARN] Supabase creds missing. DB access will fail.")
        # Create a dummy client or handle gracefully? 
        # Supabase-py throws if key is missing. 
        # We will use valid but dummy key if missing to detect config later
        if not key: key = "dummy-key-to-start-server"
    
    supabase: Client = create_client(url, key)
except Exception as e:
    print(f"[ERROR] Error initializing Supabase: {e}")
    supabase = None
