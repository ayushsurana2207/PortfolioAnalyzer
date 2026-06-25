import logging
from datetime import datetime
import yfinance as yf
from sqlmodel import Session, select

from app.models.holding import Holding, AssetClass

logger = logging.getLogger("prices")


def _get_latest_close(ticker_symbol: str) -> float:
    """Helper to get the most recent closing price for a ticker.
    
    Uses a 5-day window to ensure we get a valid price even on weekends/holidays.
    """
    ticker = yf.Ticker(ticker_symbol)
    hist = ticker.history(period="5d")
    if hist.empty:
        raise ValueError(f"No price history returned for ticker '{ticker_symbol}'")
    # Return the latest available closing price
    return float(hist["Close"].iloc[-1])


async def get_usd_inr_rate() -> float:
    """Fetches the live USD/INR exchange rate."""
    try:
        rate = _get_latest_close("USDINR=X")
        logger.info(f"Fetched live USD/INR rate: {rate:.4f}")
        return rate
    except Exception as e:
        logger.error(f"Failed to fetch USD/INR rate: {e}. Falling back to 83.5.")
        return 83.5  # Sensible fallback if API fails


async def get_stock_price_inr(ticker_symbol: str, is_usd: bool = False) -> float:
    """Fetches the price of a stock and returns it in INR.
    
    Supports both Indian equities (NSE tickers e.g., 'RELIANCE.NS') and
    US equities (e.g., 'GOOG'). Converts USD values using the live exchange rate.
    """
    price = _get_latest_close(ticker_symbol)
    if is_usd:
        rate = await get_usd_inr_rate()
        price *= rate
    return price


async def get_gold_price_inr_per_gram() -> float:
    """Calculates the price of Gold in INR per gram.
    
    Fetches COMEX Gold Futures (GC=F) in USD per Troy Ounce,
    converts to INR, and divides by 31.1035 (grams per Troy Ounce).
    """
    price_usd_oz = _get_latest_close("GC=F")
    rate = await get_usd_inr_rate()
    price_inr_oz = price_usd_oz * rate
    return price_inr_oz / 31.1035


async def get_silver_price_inr_per_gram() -> float:
    """Calculates the price of Silver in INR per gram.
    
    Fetches COMEX Silver Futures (SI=F) in USD per Troy Ounce,
    converts to INR, and divides by 31.1035 (grams per Troy Ounce).
    """
    price_usd_oz = _get_latest_close("SI=F")
    rate = await get_usd_inr_rate()
    price_inr_oz = price_usd_oz * rate
    return price_inr_oz / 31.1035


async def get_nifty50_change_pct() -> float:
    """Returns the daily percentage change of the Nifty 50 Index (^NSEI)."""
    ticker = yf.Ticker("^NSEI")
    hist = ticker.history(period="5d")
    if len(hist) < 2:
        logger.warning("Insufficient history for Nifty 50 percentage change calculation.")
        return 0.0
    # Retrieve the last two trading days
    prev_close = float(hist["Close"].iloc[-2])
    curr_close = float(hist["Close"].iloc[-1])
    pct_change = ((curr_close - prev_close) / prev_close) * 100
    logger.info(f"Fetched Nifty 50 daily change: {pct_change:.2f}%")
    return pct_change


async def refresh_all_holdings_prices(session: Session) -> None:
    """Fetches the latest prices for all active holdings and updates values in INR.
    
    Skips mutual funds without tickers (which are valued at ingestion time via NAV),
    but updates stocks, precious metals, and RSU holdings.
    """
    logger.info("Starting portfolio-wide price refresh...")
    try:
        usd_inr = await get_usd_inr_rate()
    except Exception as e:
        logger.error(f"Could not retrieve USD/INR rate for refresh: {e}")
        usd_inr = 83.5

    # Load all active holdings
    holdings = session.exec(select(Holding).where(Holding.is_active == True)).all()
    updated_count = 0

    for h in holdings:
        try:
            if h.asset_class == AssetClass.GOLD:
                price = await get_gold_price_inr_per_gram()
            elif h.asset_class == AssetClass.SILVER:
                price = await get_silver_price_inr_per_gram()
            elif h.ticker:
                is_usd = h.asset_class in (AssetClass.RSU_GOOGLE, AssetClass.RSU_ORACLE)
                price = await get_stock_price_inr(h.ticker, is_usd=is_usd)
            else:
                # No ticker (e.g. Mutual Funds which are valued by statement NAV), skip price refresh
                continue

            h.current_price_inr = price
            h.current_value_inr = price * h.quantity
            h.last_price_updated_at = datetime.utcnow()
            h.updated_at = datetime.utcnow()
            session.add(h)
            updated_count += 1
            logger.info(f"Updated price for {h.asset_name} ({h.ticker or h.asset_class}): ₹{price:,.2f}")
        except Exception as e:
            logger.error(f"Failed to refresh price for holding '{h.asset_name}': {e}")

    session.commit()
    logger.info(f"Finished price refresh. Updated {updated_count} out of {len(holdings)} active holdings.")
