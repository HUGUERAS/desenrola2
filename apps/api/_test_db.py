import os, sys
os.chdir('c:/Users/User/.gemini/antigravity/scratch/desenrola/apps/api')
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY')
sb = create_client(url, key)

# Listar todas as tabelas do schema public
r = sb.rpc('', {}).execute()  # This won't work, let's use SQL
