from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DocumentoCreate(BaseModel):
    lote_id: int
    tipo: str = "memorial"  # 'memorial', 'planta', 'contrato'
    template_id: Optional[str] = None

class DocumentoResponse(BaseModel):
    id: int
    lote_id: int
    tipo: str
    formato: str
    arquivo_url: str
    created_at: datetime
