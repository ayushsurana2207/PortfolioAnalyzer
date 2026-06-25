import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

logger = logging.getLogger("scheduler")
IST = pytz.timezone("Asia/Kolkata")
scheduler = AsyncIOScheduler(timezone=IST)


async def run_daily_flags_job():
    """Triggers the daily rule-based flag check and email notifications.
    """
    logger.info("Daily flags check cron job triggered.")
    from app.database import SessionLocal
    from app.services.flag_engine import run_daily_flags
    
    try:
        with SessionLocal() as session:
            await run_daily_flags(session)
        logger.info("Daily flags check cron job completed successfully.")
    except Exception as e:
        logger.error(f"Error in daily flags check cron job: {e}")


async def refresh_prices_job():
    """Refreshes all stock, gold, and silver prices after market close.
    """
    logger.info("Daily price refresh cron job triggered.")
    from app.database import SessionLocal
    from app.services.prices import refresh_all_holdings_prices
    
    try:
        with SessionLocal() as session:
            await refresh_all_holdings_prices(session)
        logger.info("Daily price refresh cron job completed successfully.")
    except Exception as e:
        logger.error(f"Error in daily price refresh cron job: {e}")



def setup_jobs():
    """Registers cron jobs for the background scheduler."""
    # Daily flag check at 7:00 AM IST
    scheduler.add_job(
        run_daily_flags_job,
        CronTrigger(hour=7, minute=0, timezone=IST),
        id="daily_flags",
        replace_existing=True,
        misfire_grace_time=3600
    )
    # Price refresh after market close at 4:00 PM IST
    scheduler.add_job(
        refresh_prices_job,
        CronTrigger(hour=16, minute=0, timezone=IST),
        id="price_refresh",
        replace_existing=True,
        misfire_grace_time=3600
    )
    logger.info("Scheduler jobs configured for daily flags (7:00 AM IST) and price refresh (4:00 PM IST).")
