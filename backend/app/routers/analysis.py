import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models.journal import SuggestionJournal
from app.services.monthly_review import run_monthly_review, run_deploy_capital
from app.services.flag_engine import run_daily_flags

logger = logging.getLogger("router_analysis")
router = APIRouter(prefix="/analysis", tags=["AI Analysis & Flags"])


class DeployCapitalRequest(BaseModel):
    amount_inr: float


@router.post("/monthly-review")
async def trigger_monthly_review(session: Session = Depends(get_session)):
    """Triggers the AI-powered monthly portfolio analysis, updating the suggestion journal and net worth snapshots."""
    try:
        result = await run_monthly_review(session)
        return result
    except Exception as e:
        logger.error(f"Monthly review execution failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Monthly review failed: {str(e)}"
        )


@router.post("/deploy-capital")
async def trigger_deploy_capital(
    request: DeployCapitalRequest,
    session: Session = Depends(get_session)
):
    """Generates tactical investment advice on how to allocate a fresh injection of capital."""
    if request.amount_inr <= 0:
        raise HTTPException(
            status_code=400,
            detail="Investment amount must be a positive number."
        )
    try:
        result = await run_deploy_capital(session, request.amount_inr)
        return result
    except Exception as e:
        logger.error(f"Capital deployment analysis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Capital deployment advising failed: {str(e)}"
        )


@router.post("/run-flags")
async def trigger_daily_flags(session: Session = Depends(get_session)):
    """Manually triggers the daily rule-based flag engine, executing a full price refresh and checking for risks."""
    try:
        # Manually triggering executes a full price refresh
        flags = await run_daily_flags(session, refresh_prices=True)
        return flags
    except Exception as e:
        logger.error(f"Daily flags execution failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Daily flags check failed: {str(e)}"
        )


@router.get("/latest-review", response_model=list[SuggestionJournal])
def get_latest_monthly_review_suggestions(session: Session = Depends(get_session)):
    """Retrieves all suggestions generated during the most recent monthly review session."""
    
    # 1. Find the date of the most recent monthly review
    subquery = select(SuggestionJournal.suggestion_date)\
        .where(SuggestionJournal.review_type == "MONTHLY")\
        .order_by(SuggestionJournal.suggestion_date.desc())\
        .limit(1)
    
    latest_date = session.exec(subquery).first()
    
    if not latest_date:
        return []
        
    # 2. Query all suggestions generated on that specific date
    suggestions = session.exec(
        select(SuggestionJournal)
        .where(SuggestionJournal.review_type == "MONTHLY")
        .where(SuggestionJournal.suggestion_date == latest_date)
        .order_by(SuggestionJournal.confidence_level.desc())
    ).all()
    
    return suggestions
