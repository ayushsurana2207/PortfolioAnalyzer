from app.routers.portfolio import router as portfolio_router
from app.routers.upload import router as upload_router
from app.routers.analysis import router as analysis_router
from app.routers.journal import router as journal_router
from app.routers.manual import router as manual_router
from app.routers.settings import router as settings_router

__all__ = [
    "portfolio_router",
    "upload_router",
    "analysis_router",
    "journal_router",
    "manual_router",
    "settings_router",
]
