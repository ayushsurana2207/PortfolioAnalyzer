import json
import logging
from datetime import datetime, date
from typing import List, Dict, Optional
from sqlmodel import Session, select

from app.models.holding import Holding, AssetClass
from app.models.snapshot import PortfolioSnapshot
from app.models.journal import SuggestionJournal, SuggestionType, ActionTaken, OutcomeAssessment
from app.services.llm_service import get_llm_service
from app.services.prices import refresh_all_holdings_prices, get_usd_inr_rate
from app.services.news import fetch_portfolio_news
from app.services.notifications import send_monthly_review_notification
from app.services.flag_engine import calculate_tech_concentration

logger = logging.getLogger("monthly_review")

MONTHLY_REVIEW_SYSTEM_PROMPT = """
You are a seasoned long-term investment advisor for an Indian investor's personal portfolio.
You combine Warren Buffett's long-term compounding philosophy with deep knowledge of Indian
financial markets (NSE/BSE, SEBI-regulated funds) and Indian tax law.

INVESTOR PROFILE:
- Age: 24, Software Engineer at Google India
- Investment horizon: 10+ years
- Risk tolerance: Medium-High (young, stable high income, no dependents)
- Goal: long-term wealth creation through compounding, not trading

ASSET UNIVERSE:
- Indian equities (Zerodha Kite, NSE/BSE)
- Indian mutual funds (Groww — SIP + lump sum)
- Physical gold and silver (inflation and currency hedge)
- Google RSUs (Morgan Stanley, Alphabet Inc.)
- Oracle RSUs (Fidelity, previous employer)

NON-NEGOTIABLE RULES:
1. NEVER suggest selling RSUs unless tech concentration exceeds 65% OR the specific company
   shows clear fundamental deterioration (consecutive revenue decline, loss of moat).
2. Always state LTCG vs STCG implications. Equity held < 1 year: STCG at 20%.
   Equity held > 1 year: LTCG at 12.5% above ₹1.25L annual exemption.
3. Gold + silver target: 10–15% of total portfolio.
4. Always recommend DIRECT mutual fund plans, never Regular.
5. When recommending new stocks, prefer quality large-cap and mid-cap with proven cash flows.
6. Factor in upcoming RSU vests — they will automatically increase tech concentration.
7. Be specific: exact fund name, exact ticker, exact target percentage, exact rupee amount.
8. Capital deployment priority: SIP continuity > MF lump sum > direct stocks > physical metals.

LEARNING FROM PAST (CRITICAL):
You will receive your complete suggestion journal. Before generating new suggestions:
- Read every past entry
- Note whether the user acted on each (action_taken field)
- Check outcome_assessment and outcome_pct_change
- Be honest about wrong calls — do not defend them
- Explicitly state what you would do differently in the retrospective field
- Do not repeat a suggestion already acted on unless market conditions have materially changed

OUTPUT: Return ONLY valid JSON matching this exact schema. No prose, no markdown fences:
{
  "portfolio_health": "GOOD|FAIR|NEEDS_ATTENTION",
  "health_summary": "2–3 sentences on overall portfolio health",
  "suggestions": [
    {
      "type": "BUY|REDUCE|REBALANCE|HOLD|WATCH",
      "priority": 1,
      "asset_class": "STOCK|MUTUAL_FUND|GOLD|SILVER|RSU_GOOGLE|RSU_ORACLE",
      "asset_name": "Exact name",
      "ticker": "NSE ticker or null",
      "action": "Specific, executable action with exact amount or units",
      "reasoning": "Why this makes sense for this investor right now",
      "confidence": "LOW|MEDIUM|HIGH",
      "urgency": "LOW|MEDIUM|HIGH",
      "tax_note": "LTCG/STCG consideration or null",
      "estimated_impact": "What this does to portfolio allocation"
    }
  ],
  "flags": [
    { "severity": "WARNING|INFO", "title": "...", "message": "..." }
  ],
  "deploy_capital_hint": "If the investor has ₹50,000 extra today, one sentence on where it goes",
  "retrospective": "Honest, specific reflection on past suggestions: what worked, what failed, what you'd do differently"
}
"""


def build_monthly_review_context(
    holdings: List[Holding],
    snapshots: List[PortfolioSnapshot],
    journal_entries: List[SuggestionJournal],
    news_articles: List[dict],
    usd_inr_rate: float
) -> str:
    """Compiles portfolio assets, performance history, news, and journal entries into a clean text context."""
    
    context = []
    context.append(f"CURRENT DATE: {date.today().isoformat()}")
    context.info = f"EXCHANGE RATE: 1 USD = {usd_inr_rate:.2f} INR"
    context.append(context.info)
    
    # 1. Holdings classification
    vested_holdings = [h for h in holdings if h.is_active and h.is_vested != False]
    unvested_holdings = [h for h in holdings if h.is_active and h.is_vested == False]
    
    total_value = sum(h.current_value_inr or 0.0 for h in vested_holdings)
    tech_concentration = calculate_tech_concentration(vested_holdings, total_value)
    
    context.append(f"\n=== PORTFOLIO BASICS ===")
    context.append(f"Total Vested Portfolio Value: INR {total_value:,.2f}")
    context.append(f"Current Tech Sector Concentration: {tech_concentration:.2f}%")
    
    context.append("\n=== ACTIVE VESTED HOLDINGS (INR values) ===")
    for h in vested_holdings:
        ticker_str = f" ({h.ticker})" if h.ticker else ""
        cost_str = f"Avg Cost: ₹{h.average_cost_inr:,.2f}"
        val_str = f"Current Val: ₹{h.current_value_inr:,.2f}"
        qty_str = f"Qty: {h.quantity:.4f}"
        source_str = f"Ingestion: {h.source}"
        context.append(f"- [{h.asset_class}] {h.asset_name}{ticker_str} | {qty_str} | {cost_str} | {val_str} | {source_str}")
        
    if unvested_holdings:
        context.append("\n=== UNVESTED HOLDINGS (Informational, excluded from Net Worth) ===")
        for h in unvested_holdings:
            vest_str = f"Est Vest Date: {h.vest_date}" if h.vest_date else "Vest Date: unknown"
            val_str = f"Est Value: ₹{h.current_value_inr:,.2f}"
            context.append(f"- [{h.asset_class}] {h.asset_name} | Qty: {h.quantity:.2f} | {val_str} | {vest_str}")

    # 2. Month-over-month Comparison
    if len(snapshots) > 0:
        latest_snap = snapshots[0]
        context.append(f"\n=== HISTORICAL NET WORTH SNAPSHOT ===")
        context.append(f"- Last Snapshot Date: {latest_snap.snapshot_date} | Value: INR {latest_snap.total_value_inr:,.2f} | Tech: {latest_snap.tech_concentration_pct:.1f}%")
        if len(snapshots) > 1:
            prev_snap = snapshots[1]
            mom_change = latest_snap.total_value_inr - prev_snap.total_value_inr
            mom_change_pct = (mom_change / prev_snap.total_value_inr * 100) if prev_snap.total_value_inr > 0 else 0
            context.append(f"- Prior Snapshot Date: {prev_snap.snapshot_date} | Value: INR {prev_snap.total_value_inr:,.2f}")
            context.append(f"Month-over-Month Change: INR {mom_change:+,.2f} ({mom_change_pct:+.2f}%)")

    # 3. Suggestion Journal History
    context.append("\n=== SUGGESTION JOURNAL HISTORY (PAST ADVICE) ===")
    if not journal_entries:
        context.append("No past suggestions in the database yet.")
    else:
        for entry in journal_entries:
            action_taken = entry.action_taken.value if entry.action_taken else "PENDING"
            outcome = f"{entry.outcome_pct_change:+.1f}%" if entry.outcome_pct_change is not None else "N/A"
            assessment = entry.outcome_assessment.value if entry.outcome_assessment else "PENDING"
            context.append(
                f"- [{entry.suggestion_date}] [{entry.suggestion_type.value}] {entry.asset_name or entry.asset_class} "
                f"-> \"{entry.suggestion_text}\" | Acted: {action_taken} | Outcome: {outcome} ({assessment})"
            )

    # 4. News Articles
    context.append("\n=== PORTFOLIO NEWS HEADLINES (LAST 3 DAYS) ===")
    if not news_articles:
        context.append("No recent news articles found for portfolio assets.")
    else:
        for art in news_articles[:15]:
            neg_flag = " [NEGATIVE SENTIMENT]" if art.get("is_negative") else ""
            context.append(f"- [{art['relevance_tag']}] {art['title']} ({art['source']}){neg_flag}")
            
    return "\n".join(context)


async def run_monthly_review(session: Session) -> dict:
    """Executes the full automated monthly review process.
    
    Refreshes prices, fetches news, grades historical suggestions, executes the
    multi-LLM advice generator, records new suggestions and a monthly snapshot,
    and sends an email report.
    """
    logger.info("Initiating monthly portfolio review...")
    
    # 1. Refresh all prices
    try:
        await refresh_all_holdings_prices(session)
    except Exception as e:
        logger.error(f"Price refresh failed prior to monthly review: {e}")

    # 2. Gather active assets and helper metadata
    holdings = session.exec(select(Holding).where(Holding.is_active == True)).all()
    usd_inr_rate = await get_usd_inr_rate()

    # 3. Load latest 2 snapshots for MoM comparison
    snapshots = session.exec(
        select(PortfolioSnapshot)
        .order_by(PortfolioSnapshot.snapshot_date.desc())
        .limit(2)
    ).all()

    # 4. Load all historical journal entries to learn from
    journal_entries = session.exec(
        select(SuggestionJournal)
        .order_by(SuggestionJournal.suggestion_date.desc())
    ).all()

    # 5. Fetch news
    news_articles = []
    try:
        news_articles = await fetch_portfolio_news(holdings)
    except Exception as e:
        logger.error(f"Failed to fetch portfolio news: {e}")

    # 6. Evaluate unreviewed past suggestions
    unreviewed_entries = [e for e in journal_entries if not e.is_reviewed]
    logger.info(f"Evaluating outcomes for {len(unreviewed_entries)} unreviewed suggestions...")
    
    for entry in unreviewed_entries:
        try:
            # Match current asset value
            matched_holding = None
            for h in holdings:
                if h.is_active and h.is_vested != False:
                    # Match by name or ticker
                    if entry.ticker and h.ticker == entry.ticker:
                        matched_holding = h
                        break
                    elif entry.asset_name and h.asset_name == entry.asset_name:
                        matched_holding = h
                        break
            
            current_value = matched_holding.current_value_inr if matched_holding else 0.0
            
            # If we sold or no longer hold it, or it was not in holdings:
            if not matched_holding and entry.action_taken == ActionTaken.YES:
                # If user sold it, we might not find it. For now, mark reviewed.
                entry.is_reviewed = True
                entry.updated_at = datetime.utcnow()
                session.add(entry)
                continue
                
            if entry.asset_value_at_suggestion and entry.asset_value_at_suggestion > 0:
                pct_change = ((current_value - entry.asset_value_at_suggestion) / entry.asset_value_at_suggestion) * 100
                entry.outcome_pct_change = pct_change
                entry.asset_value_at_review = current_value
                
                # Assess performance: > +5% GOOD, < -5% BAD, else NEUTRAL
                if pct_change > 5.0:
                    entry.outcome_assessment = OutcomeAssessment.GOOD
                elif pct_change < -5.0:
                    entry.outcome_assessment = OutcomeAssessment.BAD
                else:
                    entry.outcome_assessment = OutcomeAssessment.NEUTRAL
            else:
                entry.outcome_pct_change = 0.0
                entry.outcome_assessment = OutcomeAssessment.NEUTRAL
                
            entry.is_reviewed = True
            entry.updated_at = datetime.utcnow()
            session.add(entry)
        except Exception as e:
            logger.error(f"Failed to evaluate outcome for journal entry {entry.id}: {e}")

    # Commit evaluations
    session.commit()

    # Re-query journal entries now that they have been updated/reviewed
    session.expire_all()
    updated_journal_entries = session.exec(
        select(SuggestionJournal)
        .order_by(SuggestionJournal.suggestion_date.desc())
    ).all()

    # 7. Construct user context message
    user_message = build_monthly_review_context(
        holdings, snapshots, updated_journal_entries, news_articles, usd_inr_rate
    )

    # 8. Dispatch request to the pluggable LLM Service
    llm_service = get_llm_service()
    logger.info("Requesting analysis from LLM...")
    
    ai_result = await llm_service.generate_json(
        prompt=user_message,
        system_prompt=MONTHLY_REVIEW_SYSTEM_PROMPT
    )
    
    logger.info("LLM analysis retrieved successfully.")

    # Calculate active vested total value
    vested_holdings = [h for h in holdings if h.is_active and h.is_vested != False]
    total_portfolio_value = sum(h.current_value_inr or 0.0 for h in vested_holdings)
    tech_concentration = calculate_tech_concentration(vested_holdings, total_portfolio_value)

    # 9. Update retro comments on the journal entries we just graded
    retrospective_text = ai_result.get("retrospective", "")
    for entry in unreviewed_entries:
        entry.agent_retrospective = retrospective_text
        session.add(entry)

    # 10. Save new suggestions to the journal
    new_suggestions = ai_result.get("suggestions", []) or []
    
    # Calculate scheduled review date (1st of next month)
    today = date.today()
    if today.month == 12:
        next_month_review_date = date(today.year + 1, 1, 1)
    else:
        next_month_review_date = date(today.year, today.month + 1, 1)
        
    for sug in new_suggestions:
        try:
            sug_type_str = sug.get("type", "HOLD").upper()
            # Map string to SuggestionType Enum
            try:
                sug_type = SuggestionType(sug_type_str)
            except ValueError:
                sug_type = SuggestionType.HOLD
                
            # Find current value of the asset if we hold it
            matching_holding_value = 0.0
            for h in vested_holdings:
                if (sug.get("ticker") and h.ticker == sug.get("ticker")) or (sug.get("asset_name") == h.asset_name):
                    matching_holding_value = h.current_value_inr or 0.0
                    break
                    
            journal_item = SuggestionJournal(
                suggestion_date=today,
                review_type="MONTHLY",
                suggestion_type=sug_type,
                asset_class=sug.get("asset_class"),
                asset_name=sug.get("asset_name"),
                suggestion_text=sug.get("action", ""),
                reasoning=sug.get("reasoning", ""),
                confidence_level=sug.get("confidence", "MEDIUM").upper(),
                urgency=sug.get("urgency", "LOW").upper(),
                tax_note=sug.get("tax_note"),
                review_date=next_month_review_date,
                portfolio_value_at_suggestion=total_portfolio_value,
                asset_value_at_suggestion=matching_holding_value,
                is_reviewed=False
            )
            session.add(journal_item)
        except Exception as e:
            logger.error(f"Failed to record new suggestion to journal: {e}")

    # 11. Record a new MONTHLY portfolio snapshot
    # Group values for snapshot
    stocks_val = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.STOCK)
    mf_val = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.MUTUAL_FUND)
    gold_val = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.GOLD)
    silver_val = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.SILVER)
    google_rsu_val = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.RSU_GOOGLE)
    oracle_rsu_val = sum(h.current_value_inr or 0.0 for h in vested_holdings if h.asset_class == AssetClass.RSU_ORACLE)
    
    # Informational only: unvested RSUs
    unvested_rsu_val = sum(h.current_value_inr or 0.0 for h in holdings if h.is_active and h.is_vested == False)

    snapshot = PortfolioSnapshot(
        snapshot_date=today,
        snapshot_type="MONTHLY",
        total_value_inr=total_portfolio_value,
        stocks_value_inr=stocks_val,
        mf_value_inr=mf_val,
        gold_value_inr=gold_val,
        silver_value_inr=silver_val,
        rsu_google_value_inr=google_rsu_val,
        rsu_oracle_value_inr=oracle_rsu_val,
        unvested_rsu_value_inr=unvested_rsu_val,
        tech_concentration_pct=tech_concentration,
        usd_inr_rate=usd_inr_rate,
        notes=ai_result.get("health_summary", "Monthly review generated successfully.")
    )
    session.add(snapshot)
    
    # Commit all changes (new journal entries, snapshot, evaluated entries)
    session.commit()
    logger.info("Database records for monthly review committed successfully.")

    # 12. Dispatch summary report email
    try:
        await send_monthly_review_notification(ai_result)
    except Exception as e:
        logger.error(f"Failed to send monthly review email notification: {e}")

    return ai_result


async def run_deploy_capital(session: Session, amount_inr: float) -> dict:
    """Calculates tactical capital deployment recommendations for an extra cash injection.
    
    Re-uses the monthly review context and prompt rules, but targets the analysis specifically
    on how to allocate the new capital to optimize portfolio balance.
    """
    logger.info(f"Initiating capital deployment advisor for: ₹{amount_inr:,.2f}")
    
    # 1. Gather current active holdings
    holdings = session.exec(select(Holding).where(Holding.is_active == True)).all()
    usd_inr_rate = await get_usd_inr_rate()

    # 2. Load latest snapshots
    snapshots = session.exec(
        select(PortfolioSnapshot)
        .order_by(PortfolioSnapshot.snapshot_date.desc())
        .limit(2)
    ).all()

    # 3. Load past suggestions
    journal_entries = session.exec(
        select(SuggestionJournal)
        .order_by(SuggestionJournal.suggestion_date.desc())
    ).all()

    # 4. Fetch news
    news_articles = []
    try:
        news_articles = await fetch_portfolio_news(holdings)
    except Exception as e:
        logger.error(f"Failed to fetch portfolio news: {e}")

    # 5. Build base monthly review context
    base_context = build_monthly_review_context(
        holdings, snapshots, journal_entries, news_articles, usd_inr_rate
    )
    
    # 6. Append the specific capital deployment question
    deployment_query = (
        f"{base_context}\n\n"
        f"SPECIFIC QUESTION: The investor has ₹{amount_inr} of additional capital to deploy right now.\n"
        f"Where should it go? Consider the current portfolio state and recent suggestions.\n\n"
        f"Return ONLY this JSON schema:\n"
        f"{{\n"
        f"  \"amount_inr\": {amount_inr},\n"
        f"  \"recommendations\": [\n"
        f"    {{\n"
        f"      \"allocation_pct\": 0,\n"
        f"      \"amount_inr\": 0,\n"
        f"      \"asset_name\": \"Exact fund or stock name\",\n"
        f"      \"action\": \"Specific steps to execute this allocation\",\n"
        f"      \"reasoning\": \"Why this allocation\"\n"
        f"    }}\n"
        f"  ],\n"
        f"  \"total_check\": \"Verify all allocation_pct values sum to 100\",\n"
        f"  \"tax_considerations\": \"Any immediate tax notes or null\",\n"
        f"  \"overall_reasoning\": \"One paragraph on why this split suits the portfolio right now\"\n"
        f"}}"
    )
    
    # 7. Execute query via the LLM service
    llm_service = get_llm_service()
    logger.info("Requesting capital deployment recommendations from LLM...")
    
    ai_result = await llm_service.generate_json(
        prompt=deployment_query,
        system_prompt=MONTHLY_REVIEW_SYSTEM_PROMPT
    )
    
    logger.info("Capital deployment advice retrieved successfully.")
    return ai_result

