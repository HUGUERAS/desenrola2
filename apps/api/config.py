"""Configuração do Desenrola API."""
import os
from dotenv import load_dotenv

load_dotenv()


def _parse_cors_origins(raw: str | None) -> list[str]:
    """Converte CORS_ORIGINS em lista limpa, com fallback seguro para dev."""
    if not raw:
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ]

    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


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
    CORS_ORIGINS = _parse_cors_origins(os.getenv("CORS_ORIGINS"))

    # Geo validation — SIRGAS 2000 (SRID 4674)
    SRID = 4674
    AREA_MIN_M2 = float(os.getenv("AREA_MIN_M2", 100))
    GAP_TOLERANCE_M2 = float(os.getenv("GAP_TOLERANCE_M2", 1))

    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8010))


settings = Settings()
