import logging
from datetime import datetime, date
from typing import Optional, List

from app.models.holding import Holding, AssetClass
from app.models.pdf_upload import UploadType
from app.services.llm_service import get_llm_service

logger = logging.getLogger("pdf_parser")


def get_parser_prompt(upload_type: UploadType) -> str:
    """Returns the exact system prompts defined in the specification for each document type."""
    
    if upload_type in (UploadType.ONBOARD_RSU_FIDELITY, UploadType.MONTHLY_RSU_FIDELITY):
        return """You are parsing an Oracle RSU equity award statement from Fidelity NetBenefits.
Return ONLY valid JSON. No prose, no markdown, no code fences.

{
  "statement_date": "YYYY-MM-DD",
  "account_holder": "Full Name",
  "currency": "USD",
  "grants": [
    {
      "grant_id": "string",
      "grant_date": "YYYY-MM-DD",
      "grant_price_usd": 0.00,
      "total_units_granted": 0,
      "vested_units": 0,
      "unvested_units": 0,
      "current_market_price_usd": 0.00,
      "current_value_usd": 0.00
    }
  ],
  "upcoming_vests": [
    { "vest_date": "YYYY-MM-DD", "units": 0, "estimated_value_usd": 0.00 }
  ],
  "total_vested_value_usd": 0.00,
  "total_unvested_value_usd": 0.00
}

Use null for any field not found. Do not guess or invent values."""

    elif upload_type in (UploadType.ONBOARD_RSU_MS, UploadType.MONTHLY_RSU_MS):
        return """You are parsing a Google RSU equity award statement from Morgan Stanley StockPlan Connect.
Return ONLY valid JSON. No prose, no markdown, no code fences.

{
  "statement_date": "YYYY-MM-DD",
  "account_holder": "Full Name",
  "currency": "USD",
  "grants": [
    {
      "grant_id": "string",
      "grant_date": "YYYY-MM-DD",
      "grant_price_usd": 0.00,
      "total_units_granted": 0,
      "vested_units": 0,
      "unvested_units": 0,
      "current_market_price_usd": 0.00,
      "current_value_usd": 0.00
    }
  ],
  "upcoming_vests": [
    { "vest_date": "YYYY-MM-DD", "units": 0, "estimated_value_usd": 0.00 }
  ],
  "total_vested_value_usd": 0.00,
  "total_unvested_value_usd": 0.00
}

Use null for any field not found."""

    elif upload_type in (UploadType.ONBOARD_MF_GROWW, UploadType.MONTHLY_MF_GROWW):
        return """You are parsing a Groww mutual fund portfolio statement.
Return ONLY valid JSON. No prose, no markdown, no code fences.

{
  "statement_date": "YYYY-MM-DD",
  "account_holder": "Full Name",
  "currency": "INR",
  "funds": [
    {
      "fund_name": "Exact full fund name",
      "folio_number": "string or null",
      "units": 0.000,
      "nav": 0.00,
      "current_value_inr": 0.00,
      "invested_amount_inr": 0.00,
      "fund_category": "Large Cap|Mid Cap|Small Cap|Flexi Cap|ELSS|Debt|Hybrid|Index|Sectoral|Other",
      "scheme_type": "Direct|Regular"
    }
  ],
  "total_invested_inr": 0.00,
  "total_current_value_inr": 0.00
}

Use null for any field not found."""

    elif upload_type in (UploadType.ONBOARD_STOCKS_KITE, UploadType.MONTHLY_STOCKS_KITE):
        return """You are parsing a Zerodha Kite portfolio holdings or tax P&L statement.
Return ONLY valid JSON. No prose, no markdown, no code fences.

{
  "statement_date": "YYYY-MM-DD",
  "account_holder": "Full Name",
  "currency": "INR",
  "holdings": [
    {
      "stock_name": "Company full name",
      "ticker_nse": "NSE ticker e.g. RELIANCE",
      "quantity": 0,
      "average_cost_inr": 0.00,
      "current_price_inr": 0.00,
      "current_value_inr": 0.00,
      "pnl_inr": 0.00,
      "sector": "IT|Banking|FMCG|Auto|Pharma|Energy|Metals|Telecom|Realty|Other"
    }
  ],
  "total_invested_inr": 0.00,
  "total_current_value_inr": 0.00
}

Use null for any field not found."""

    else:
        raise ValueError(f"Unknown upload type: {upload_type}")


async def parse_pdf(file_bytes: bytes, upload_type: UploadType) -> dict:
    """Invokes the configured LLM service to parse the uploaded PDF document."""
    llm_service = get_llm_service()
    prompt = get_parser_prompt(upload_type)
    logger.info(f"Triggering PDF parsing for upload type: {upload_type}")
    
    try:
        parsed_data = await llm_service.parse_pdf(file_bytes, prompt)
        logger.info("PDF parsing completed successfully.")
        return parsed_data
    except Exception as e:
        logger.error(f"Failed to parse PDF using LLM: {e}")
        raise e


def map_to_holdings(parsed_data: dict, upload_type: UploadType, usd_inr_rate: float) -> List[Holding]:
    """Converts raw structured JSON extracted by the LLM into concrete Holding instances.
    
    Handles currency conversions for foreign assets and formats identifiers correctly.
    """
    holdings: List[Holding] = []
    
    # 1. RSU statements (Fidelity / Morgan Stanley)
    if upload_type in (UploadType.ONBOARD_RSU_FIDELITY, UploadType.MONTHLY_RSU_FIDELITY,
                       UploadType.ONBOARD_RSU_MS, UploadType.MONTHLY_RSU_MS):
        
        is_fidelity = upload_type in (UploadType.ONBOARD_RSU_FIDELITY, UploadType.MONTHLY_RSU_FIDELITY)
        asset_class = AssetClass.RSU_ORACLE if is_fidelity else AssetClass.RSU_GOOGLE
        ticker = "ORCL" if is_fidelity else "GOOG"
        source = "FIDELITY" if is_fidelity else "MS"
        exchange = "NYSE"
        
        grants = parsed_data.get("grants", []) or []
        upcoming_vests = parsed_data.get("upcoming_vests", []) or []
        
        # Determine next upcoming vest date if available
        next_vest_date: Optional[date] = None
        if upcoming_vests:
            try:
                # Find the earliest vest date in the future
                vest_dates = []
                for v in upcoming_vests:
                    v_date_str = v.get("vest_date")
                    if v_date_str:
                        vest_dates.append(date.fromisoformat(v_date_str))
                if vest_dates:
                    next_vest_date = min(vest_dates)
            except Exception as e:
                logger.warning(f"Error parsing upcoming vest dates: {e}")
        
        for g in grants:
            grant_id = g.get("grant_id")
            grant_date_str = g.get("grant_date")
            grant_date = date.fromisoformat(grant_date_str) if grant_date_str else None
            
            # Unit counts
            vested_units = float(g.get("vested_units") or 0)
            unvested_units = float(g.get("unvested_units") or 0)
            
            # Prices (originally in USD, converted to INR)
            grant_price_usd = float(g.get("grant_price_usd") or 0)
            current_market_price_usd = float(g.get("current_market_price_usd") or 0)
            
            average_cost_inr = grant_price_usd * usd_inr_rate
            current_price_inr = current_market_price_usd * usd_inr_rate
            
            # Create holding for vested units (if any exist)
            if vested_units > 0:
                vested_holding = Holding(
                    asset_class=asset_class,
                    asset_name=f"{'Oracle' if is_fidelity else 'Google'} RSU (Vested)",
                    ticker=ticker,
                    quantity=vested_units,
                    average_cost_inr=average_cost_inr,
                    current_price_inr=current_price_inr,
                    current_value_inr=vested_units * current_price_inr,
                    currency="USD",
                    exchange=exchange,
                    source=source,
                    grant_id=grant_id,
                    is_vested=True,
                    sector="IT",
                    is_active=True
                )
                holdings.append(vested_holding)
            
            # Create holding for unvested units (if any exist)
            if unvested_units > 0:
                unvested_holding = Holding(
                    asset_class=asset_class,
                    asset_name=f"{'Oracle' if is_fidelity else 'Google'} RSU (Unvested)",
                    ticker=ticker,
                    quantity=unvested_units,
                    average_cost_inr=average_cost_inr,
                    current_price_inr=current_price_inr,
                    current_value_inr=unvested_units * current_price_inr,
                    currency="USD",
                    exchange=exchange,
                    source=source,
                    grant_id=grant_id,
                    is_vested=False,
                    vest_date=next_vest_date,  # Assign next known vest date
                    sector="IT",
                    is_active=True
                )
                holdings.append(unvested_holding)
                
    # 2. Mutual Fund statements (Groww)
    elif upload_type in (UploadType.ONBOARD_MF_GROWW, UploadType.MONTHLY_MF_GROWW):
        funds = parsed_data.get("funds", []) or []
        for f in funds:
            fund_name = f.get("fund_name")
            units = float(f.get("units") or 0)
            nav = float(f.get("nav") or 0)
            current_value_inr = float(f.get("current_value_inr") or 0)
            invested_amount_inr = float(f.get("invested_amount_inr") or 0)
            
            # Safe calculation of average cost
            average_cost_inr = (invested_amount_inr / units) if units > 0 else nav
            
            mf_holding = Holding(
                asset_class=AssetClass.MUTUAL_FUND,
                asset_name=fund_name,
                ticker=None,  # Mutual funds in India do not use standard yfinance tickers
                quantity=units,
                average_cost_inr=average_cost_inr,
                current_price_inr=nav,
                current_value_inr=current_value_inr,
                currency="INR",
                exchange=None,
                source="GROWW",
                folio_number=f.get("folio_number"),
                fund_category=f.get("fund_category"),
                scheme_type=f.get("scheme_type"),
                is_active=True
            )
            holdings.append(mf_holding)

    # 3. Stock statements (Zerodha Kite)
    elif upload_type in (UploadType.ONBOARD_STOCKS_KITE, UploadType.MONTHLY_STOCKS_KITE):
        items = parsed_data.get("holdings", []) or []
        for item in items:
            stock_name = item.get("stock_name")
            ticker_nse = item.get("ticker_nse")
            
            # Format ticker to match Yahoo Finance format (e.g. RELIANCE -> RELIANCE.NS)
            ticker = None
            if ticker_nse:
                ticker = ticker_nse.strip().upper()
                if not ticker.endswith(".NS") and not ticker.endswith(".BO"):
                    ticker = f"{ticker}.NS"
            
            quantity = float(item.get("quantity") or 0)
            average_cost_inr = float(item.get("average_cost_inr") or 0)
            current_price_inr = float(item.get("current_price_inr") or 0)
            current_value_inr = float(item.get("current_value_inr") or 0)
            
            stock_holding = Holding(
                asset_class=AssetClass.STOCK,
                asset_name=stock_name,
                ticker=ticker,
                quantity=quantity,
                average_cost_inr=average_cost_inr,
                current_price_inr=current_price_inr,
                current_value_inr=current_value_inr,
                currency="INR",
                exchange="NSE",
                source="KITE",
                sector=item.get("sector"),
                is_active=True
            )
            holdings.append(stock_holding)
            
    return holdings
