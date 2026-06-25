import logging
from sqlmodel import Session, select

from app.models.holding import Holding, AssetClass
from app.models.settings import AppSetting
from app.services.prices import (
    refresh_all_holdings_prices,
    get_nifty50_change_pct,
)
from app.services.news import fetch_portfolio_news
from app.services.notifications import send_flags_notification

logger = logging.getLogger("flag_engine")


def get_setting_value(session: Session, key: str, default: float) -> float:
    """Helper to retrieve setting values from the DB and convert to float."""
    res = session.exec(select(AppSetting).where(AppSetting.key == key)).first()
    if res:
        try:
            return float(res.value)
        except ValueError:
            logger.warning(f"Could not convert setting '{key}' value '{res.value}' to float. Using default: {default}")
    return default


def calculate_tech_concentration(holdings: list[Holding], total_portfolio_value: float) -> float:
    """Computes the tech sector exposure of the portfolio.
    
    Rules:
    - RSU_GOOGLE & RSU_ORACLE: 100% tech.
    - Stocks: 100% tech if sector is 'IT'.
    - Mutual Funds: 100% tech if fund_category is 'Sectoral' and name contains 'tech/IT/digital' (case-insensitive).
    - Other Mutual Funds: 20% tech (conservative industry-wide allocation estimate).
    - Cash/Gold/Silver/Physical/Others: 0% tech.
    """
    if total_portfolio_value <= 0:
        return 0.0
        
    tech_value = 0.0
    
    for h in holdings:
        # Skip inactive and unvested assets
        if not h.is_active or h.is_vested == False:
            continue
            
        val = h.current_value_inr or 0.0
        
        if h.asset_class in (AssetClass.RSU_GOOGLE, AssetClass.RSU_ORACLE):
            tech_value += val
        elif h.asset_class == AssetClass.STOCK and h.sector and h.sector.upper() == "IT":
            tech_value += val
        elif h.asset_class == AssetClass.MUTUAL_FUND:
            name_lower = h.asset_name.lower() if h.asset_name else ""
            category_upper = h.fund_category.upper() if h.fund_category else ""
            
            is_tech_sectoral = (
                "SECTORAL" in category_upper and 
                any(keyword in name_lower for keyword in ["tech", "it", "digital"])
            )
            
            if is_tech_sectoral:
                tech_value += val
            else:
                # Conservative estimate: 20% of general mutual fund assets are tech-exposed
                tech_value += val * 0.20
                
    return (tech_value / total_portfolio_value) * 100


async def run_daily_flags(session: Session, refresh_prices: bool = True) -> list[dict]:
    """Runs a full suite of daily portfolio diagnostic checks.
    
    Refreshes prices (if refresh_prices is True), calculates allocations, checks
    for threshold breaches, analyzes adverse news stories, and sends an email report.
    """
    logger.info(f"Daily flag engine run initiated (refresh_prices={refresh_prices}).")
    
    # 1. Conditionally refresh live prices for all holdings
    if refresh_prices:
        try:
            await refresh_all_holdings_prices(session)
        except Exception as e:
            logger.error(f"Price refresh failed during daily flag execution: {e}")


    # 2. Retrieve threshold parameters from Settings
    tech_concentration_threshold = get_setting_value(session, "tech_concentration_threshold", 40.0)
    single_stock_threshold = get_setting_value(session, "single_stock_threshold", 20.0)
    drawdown_alert_pct = get_setting_value(session, "drawdown_alert_pct", 15.0)

    # 3. Fetch active holdings and calculate totals
    holdings = session.exec(select(Holding).where(Holding.is_active == True)).all()
    
    # Exclude unvested RSUs from portfolio value and risk calculations
    vested_holdings = [h for h in holdings if h.is_vested != False]
    total_portfolio_value = sum(h.current_value_inr or 0.0 for h in vested_holdings)
    
    triggered_flags = []
    
    if total_portfolio_value <= 0:
        logger.warning("Active portfolio value is zero. Skipping allocation checks.")
        return []

    # --- FLAG CHECK 1: Tech Concentration ---
    tech_concentration_pct = calculate_tech_concentration(vested_holdings, total_portfolio_value)
    logger.info(f"Calculated tech concentration: {tech_concentration_pct:.2f}% (Threshold: {tech_concentration_threshold}%)")
    
    if tech_concentration_pct > tech_concentration_threshold:
        triggered_flags.append({
            "severity": "WARNING",
            "title": "High Tech Concentration",
            "message": (
                f"Your technology sector exposure is at {tech_concentration_pct:.1f}%, "
                f"which exceeds your customized warning threshold of {tech_concentration_threshold}%."
            )
        })

    # --- FLAG CHECK 2: Single Holding Concentration ---
    for h in vested_holdings:
        val = h.current_value_inr or 0.0
        holding_pct = (val / total_portfolio_value) * 100
        if holding_pct > single_stock_threshold:
            triggered_flags.append({
                "severity": "WARNING",
                "title": f"Single Asset Concentration: {h.asset_name}",
                "message": (
                    f"'{h.asset_name}' ({h.ticker or 'MF'}) makes up {holding_pct:.1f}% of your total portfolio, "
                    f"exceeding your single-asset threshold of {single_stock_threshold}%."
                )
            })

    # --- FLAG CHECK 3: Individual Asset Drawdowns ---
    for h in vested_holdings:
        # Check only individual equities (Kite stocks and US RSUs)
        if h.asset_class in (AssetClass.STOCK, AssetClass.RSU_GOOGLE, AssetClass.RSU_ORACLE):
            curr_price = h.current_price_inr or 0.0
            avg_cost = h.average_cost_inr or 0.0
            
            if avg_cost > 0 and curr_price < avg_cost * (1 - drawdown_alert_pct / 100):
                drawdown_pct = ((avg_cost - curr_price) / avg_cost) * 100
                triggered_flags.append({
                    "severity": "WARNING",
                    "title": f"Drawdown Alert: {h.asset_name}",
                    "message": (
                        f"Asset price has fallen by {drawdown_pct:.1f}% below your average purchase cost. "
                        f"Average cost: ₹{avg_cost:,.2f} | Current price: ₹{curr_price:,.2f}."
                    )
                })

    # --- FLAG CHECK 4: Adverse News Screening ---
    try:
        articles = await fetch_portfolio_news(holdings)
        # Scan top 10 articles for negative sentiment matches
        negative_articles = [a for a in articles[:10] if a.get("is_negative")]
        
        for art in negative_articles:
            triggered_flags.append({
                "severity": "WARNING",
                "title": f"Adverse News: {art['relevance_tag']}",
                "message": f"{art['title']} (Source: {art['source']})",
                "url": art["url"]
            })
    except Exception as e:
        logger.error(f"Failed to screen news during daily flag checks: {e}")

    # --- FLAG CHECK 5: Broad Market Crash (Nifty 50) ---
    try:
        nifty_change = await get_nifty50_change_pct()
        if nifty_change < -3.0:
            triggered_flags.append({
                "severity": "WARNING",
                "title": "Nifty 50 Market Crash",
                "message": (
                    f"The Nifty 50 index has dropped by {nifty_change:.2f}% today, "
                    f"indicating significant broad market selling pressure."
                )
            })
    except Exception as e:
        logger.error(f"Failed to query Nifty 50 performance: {e}")

    # 5. Dispatch email notification if any flags are active
    if triggered_flags:
        logger.info(f"Daily flags check triggered {len(triggered_flags)} alerts. Sending email notification...")
        try:
            await send_flags_notification(triggered_flags, total_portfolio_value)
        except Exception as e:
            logger.error(f"Failed to send daily flags email notification: {e}")
    else:
        logger.info("Daily flags check completed. No alerts triggered.")
        
    return triggered_flags
