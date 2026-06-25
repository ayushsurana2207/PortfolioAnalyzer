from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import create_db_and_tables
from app.scheduler import scheduler, setup_jobs
from app.routers import (
    portfolio_router,
    upload_router,
    analysis_router,
    journal_router,
    manual_router,
    settings_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages application startup and shutdown events.
    
    Handles database table initialization, default setting seeding, and
    background cron job scheduler lifecycle.
    """
    # Startup actions
    create_db_and_tables()
    setup_jobs()
    scheduler.start()
    
    yield
    
    # Shutdown actions
    scheduler.shutdown()


app = FastAPI(
    title="Portfolio AI Agent",
    description="Advisory AI agent for personal investment portfolio tracking and review.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS middleware
origins = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers under /api prefix
app.include_router(portfolio_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(journal_router, prefix="/api")
app.include_router(manual_router, prefix="/api")
app.include_router(settings_router, prefix="/api")


@app.get("/health", tags=["System Health"])
async def health_check():
    """Simple health check endpoint to verify system status and local time."""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat()
    }
