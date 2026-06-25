import logging
import time
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models.holding import Holding, AssetClass
from app.models.snapshot import PortfolioSnapshot
from app.services.prices import refresh_all_holdings_prices
from app.services.flag_engine import run_daily_flags
from app.services.news import fetch_portfolio_news

logger = logging.getLogger("router_portfolio")
router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

# In-memory cache for news to prevent rate-limiting (1 hour expiration)
NEWS_CACHE = {
    "articles": None,
    "timestamp": 0.0
}
CACHE_DURATION_SECONDS = 3600.0


class DashboardSummary(BaseModel):
    current_snapshot: Optional[PortfolioSnapshot] = None
    holdings_by_class: Dict[str, List[Holding]]
    active_flags: List[dict]
    upcoming_vests: List[Holding]  # Returned empty if unneeded, kept for schema safety
    recent_news: List[dict]
    prices_last_updated: Optional[datetime] = None


async def get_cached_news(holdings: List[Holding]) -> List[dict]:
    """Retrieves news articles, serving from cache if fresh (under 1 hour old)."""
    now = time.time()
    if NEWS_CACHE["articles"] is not None and (now - NEWS_CACHE["timestamp"]) < CACHE_DURATION_SECONDS:
        logger.info("Serving news articles from in-memory cache.")
        return NEWS_CACHE["articles"]
    
    logger.info("News cache expired or empty. Querying NewsAPI...")
    try:
        articles = await fetch_portfolio_news(holdings)
        NEWS_CACHE["articles"] = articles
        NEWS_CACHE["timestamp"] = now
        return articles
    except Exception as e:
        logger.error(f"Failed to fetch fresh news: {e}")
        return NEWS_CACHE["articles"] or []  # Return stale cache as fallback


@router.get("/summary", response_model=DashboardSummary)
async def get_portfolio_summary(session: Session = Depends(get_session)):
    """Assembles and returns a complete, rich dashboard summary for the portfolio."""
    
    # 1. Fetch active holdings
    holdings = session.exec(select(Holding).where(Holding.is_active == True)).all()
    
    # Group holdings by asset class
    holdings_by_class: Dict[str, List[Holding]] = {
        ac.value: [] for ac in AssetClass
    }
    for h in holdings:
        holdings_by_class[h.asset_class.value].append(h)
        
    # Find maximum last_price_updated_at across all holdings
    updated_times = [h.last_price_updated_at for h in holdings if h.last_price_updated_at]
    prices_last_updated = max(updated_times) if updated_times else None

    # 2. Fetch or synthesize current snapshot
    current_snapshot = session.exec(
        select(PortfolioSnapshot)
        .order_by(PortfolioSnapshot.snapshot_date.desc())
    ).first()
    
    if not current_snapshot and holdings:
        # Synthesize a real-time snapshot on the fly if none exists in the DB yet
        vested_holdings = [h for h in holdings if h.is_vested != False]
        total_val = sum(h.current_value_inr or 0.0 for h in vested_holdings)
        
        stocks_val = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.STOCK)
        mf_val = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.MUTUAL_FUND)
        gold_val = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.GOLD)
        silver_val = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.SILVER)
        google_rsu = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.RSU_GOOGLE)
        oracle_rsu = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.RSU_ORACLE)
        unvested_rsu = sum(h.current_value_inr or 0.0 for h in holdings if h.is_vested == False)
        
        # Calculate tech concentration
        from app.services.flag_engine import calculate_tech_concentration
        tech_pct = calculate_tech_concentration(vested_holdings, total_val)
        
        from app.services.prices import get_usd_inr_rate
        usd_rate = 83.5
        try:
            # We don't want to block, so do a quick fetch
            import yfinance as yf
            hist = yf.Ticker("USDINR=X").history(period="1d")
            if not hist.empty:
                usd_rate = float(hist["Close"].iloc[-1])
        except Exception:
            pass

        current_snapshot = PortfolioSnapshot(
            snapshot_date=date.today(),
            snapshot_type="DAILY",
            total_value_inr=total_val,
            stocks_value_inr=stocks_val,
            mf_value_inr=mf_val,
            gold_value_inr=gold_val,
            silver_value_inr=silver_val,
            rsu_google_value_inr=google_rsu,
            rsu_oracle_value_inr=oracle_rsu,
            unvested_rsu_value_inr=unvested_rsu,
            tech_concentration_pct=tech_pct,
            usd_inr_rate=usd_rate,
            notes="Synthesized real-time summary"
        )

    # 3. Calculate active flags (skip price refresh for high performance)
    active_flags = []
    if holdings:
        try:
            active_flags = await run_daily_flags(session, refresh_prices=False)
        except Exception as e:
            logger.error(f"Error running real-time flags for summary: {e}")

    # 4. Upcoming vests (always empty list in line with 'not needed' instruction, kept for schema compatibility)
    upcoming_vests = []

    # 5. Fetch cached news
    recent_news = []
    if holdings:
        recent_news = await get_cached_news(holdings)
        # Cap at 10 articles
        recent_news = recent_news[:10]

    return DashboardSummary(
        current_snapshot=current_snapshot,
        holdings_by_class=holdings_by_class,
        active_flags=active_flags,
        upcoming_vests=upcoming_vests,
        recent_news=recent_news,
        prices_last_updated=prices_last_updated
    )


@router.get("/holdings", response_model=List[Holding])
def get_active_holdings(session: Session = Depends(get_session)):
    """Returns a flat list of all active holdings in the portfolio."""
    return session.exec(select(Holding).where(Holding.is_active == True)).all()


@router.get("/snapshots", response_model=List[PortfolioSnapshot])
def get_snapshot_history(limit: int = 13, session: Session = Depends(get_session)):
    """Returns historical portfolio snapshots to populate the net worth trend chart.
    
    Defaults to returning the last 13 snapshots (covers 1 year of monthly reviews + current).
    """
    return session.exec(
        select(PortfolioSnapshot)
        .order_by(PortfolioSnapshot.snapshot_date.desc())
        .limit(limit)
    ).all()


@router.post("/refresh-prices", response_model=DashboardSummary)
async def trigger_price_refresh(session: Session = Depends(get_session)):
    """Manually triggers a portfolio-wide price refresh, updates valuation, and returns the updated summary."""
    try:
        await refresh_all_holdings_prices(session)
        # Invalidate news cache on manual refresh to pull fresh stories
        NEWS_CACHE["articles"] = None
        NEWS_CACHE["timestamp"] = 0.0
        
        # Return fresh summary
        return await get_portfolio_summary(session)
    except Exception as e:
        logger.error(f"Manual price refresh failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refresh holdings prices: {str(e)}"
        )
