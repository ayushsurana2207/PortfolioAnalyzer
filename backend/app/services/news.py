import asyncio
from datetime import datetime, timedelta
import logging
from typing import List, Dict, Tuple, Set
import httpx

from app.config import get_settings
from app.models.holding import Holding, AssetClass

logger = logging.getLogger("news")

NEGATIVE_KEYWORDS = [
    "fraud", "scam", "default", "insolvency", "delisted", "sebi ban", 
    "cbi raid", "ed raid", "downgrade", "recall", "probe", "investigation", 
    "lawsuit", "penalty", "class action", "bankruptcy", "fir", "arrest", 
    "whistleblower"
]


def detect_negative_keywords(text: str) -> bool:
    """Returns True if the text contains any high-risk negative keywords.
    
    Used to flag potential governance, regulatory, or severe financial risks.
    """
    if not text:
        return False
    text_lower = text.lower()
    for keyword in NEGATIVE_KEYWORDS:
        if keyword in text_lower:
            return True
    return False


def build_news_queries(holdings: List[Holding]) -> List[Tuple[str, str]]:
    """Generates targeted news query strings and their relevance tags for active assets.
    
    Deduplicates queries and limits the total count to 8 to stay within NewsAPI limits.
    Returns a list of tuples: (query_string, relevance_tag)
    """
    queries_set: Set[Tuple[str, str]] = set()
    active_classes = {h.asset_class for h in holdings if h.is_active}
    
    # Process US tech holdings
    if AssetClass.RSU_GOOGLE in active_classes:
        queries_set.add(('"Google" OR "Alphabet" stock earnings', "GOOG"))
    if AssetClass.RSU_ORACLE in active_classes:
        queries_set.add(('"Oracle" stock earnings results', "ORCL"))
        
    # Process Gold/Silver holdings
    if AssetClass.GOLD in active_classes:
        queries_set.add(('"gold price" India MCX', "GOLD"))
    if AssetClass.SILVER in active_classes:
        queries_set.add(('"silver price" India MCX', "SILVER"))
        
    # Process Indian Stock holdings (unique names)
    stock_holdings = [h for h in holdings if h.is_active and h.asset_class == AssetClass.STOCK]
    unique_stocks = {h.asset_name: h.ticker for h in stock_holdings}
    
    for name, ticker in unique_stocks.items():
        # Clean name a bit to avoid long queries (e.g., remove "Ltd", "Limited")
        clean_name = name.replace("Limited", "").replace("Ltd.", "").replace("Ltd", "").strip()
        query = f'"{clean_name}" NSE India'
        tag = ticker.replace(".NS", "") if ticker else clean_name
        queries_set.add((query, tag))
        
    # Convert to list and limit to 7 so we can always add 1 general market query
    queries_list = list(queries_set)[:7]
    
    # Always append a general Indian market query for context
    queries_list.append(('"Nifty 50" OR "BSE Sensex" India', "Market"))
    
    # Final safety cap at 8
    return queries_list[:8]


async def _fetch_single_query(
    client: httpx.AsyncClient, 
    query: str, 
    tag: str, 
    api_key: str, 
    from_date: str
) -> List[Dict]:
    """Helper to execute a single NewsAPI query and tag the results."""
    url = "https://newsapi.org/v2/everything"
    params = {
        "q": query,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 5,
        "from": from_date,
        "apiKey": api_key
    }
    
    try:
        response = await client.get(url, params=params, timeout=10.0)
        if response.status_code != 200:
            logger.error(f"NewsAPI error for query '{query}': {response.status_code} - {response.text}")
            return []
            
        data = response.json()
        articles = data.get("articles", []) or []
        
        tagged_articles = []
        for article in articles:
            # Skip articles without title or url
            if not article.get("title") or not article.get("url"):
                continue
            
            tagged_articles.append({
                "title": article.get("title"),
                "description": article.get("description") or "",
                "url": article.get("url"),
                "source": article.get("source", {}).get("name") or "Unknown",
                "published_at": article.get("publishedAt"),
                "relevance_tag": tag
            })
        return tagged_articles
    except Exception as e:
        logger.error(f"HTTP request failed for news query '{query}': {e}")
        return []


async def fetch_portfolio_news(holdings: List[Holding]) -> List[Dict]:
    """Fetches and aggregates recent, highly-targeted news articles for portfolio assets.
    
    Runs multiple API queries concurrently using httpx and sorts results chronologically.
    Filters out duplicates and flags articles containing high-risk negative keywords.
    """
    settings = get_settings()
    if not settings.NEWS_API_KEY:
        logger.warning("NEWS_API_KEY is not configured. Skipping news fetch.")
        return []
        
    queries = build_news_queries(holdings)
    if not queries:
        return []
        
    # Calculate starting date (3 days ago in YYYY-MM-DD format)
    from_date = (datetime.utcnow() - timedelta(days=3)).strftime("%Y-%m-%d")
    logger.info(f"Fetching news since {from_date} for queries: {[q[1] for q in queries]}")
    
    all_articles = []
    seen_urls = set()
    
    async with httpx.AsyncClient() as client:
        # Run all queries concurrently
        tasks = [
            _fetch_single_query(client, q, tag, settings.NEWS_API_KEY, from_date)
            for q, tag in queries
        ]
        results = await asyncio.gather(*tasks)
        
        for articles in results:
            for article in articles:
                url = article["url"]
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                
                # Check for negative keywords in title + description
                full_text = f"{article['title']} {article['description']}"
                article["is_negative"] = detect_negative_keywords(full_text)
                
                all_articles.append(article)
                
    # Sort articles chronologically (newest first)
    all_articles.sort(key=lambda x: x["published_at"] or "", reverse=True)
    
    logger.info(f"Aggregated {len(all_articles)} unique articles across {len(queries)} asset queries.")
    return all_articles
