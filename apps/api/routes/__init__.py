from routes.projetos import router as projetos_router
from routes.lotes import router as lotes_router
from routes.financeiro import router as financeiro_router

__all__ = ["projetos_router", "lotes_router", "financeiro_router"]
