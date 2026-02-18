"""Configuração do Desenrola API."""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """App settings."""

    # Environment
    ENV = os.getenv("ENV", "development")
    DEBUG = os.getenv("DEBUG", "False") == "True"

    # Supabase
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

    # JWT
    JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SUPABASE_JWT_SECRET", "")
    JWT_ALGORITHM = "HS256"

    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

    # Geo validation — SIRGAS 2000 (SRID 4674)
    SRID = 4674
    AREA_MIN_M2 = float(os.getenv("AREA_MIN_M2", 100))
    GAP_TOLERANCE_M2 = float(os.getenv("GAP_TOLERANCE_M2", 1))

    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8010))


settings = Settings()
