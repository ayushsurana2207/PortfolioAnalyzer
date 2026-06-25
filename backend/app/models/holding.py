from enum import Enum
from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field


class AssetClass(str, Enum):
    """Supported asset classes in the portfolio."""
    STOCK = "STOCK"
    MUTUAL_FUND = "MUTUAL_FUND"
    GOLD = "GOLD"
    SILVER = "SILVER"
    RSU_GOOGLE = "RSU_GOOGLE"
    RSU_ORACLE = "RSU_ORACLE"


class Holding(SQLModel, table=True):
    """Represents a specific asset holding in the portfolio.
    
    Can represent stocks, mutual funds, physical precious metals, or RSUs.
    All monetary values (average_cost_inr, current_price_inr, current_value_inr)
    are tracked and displayed in INR.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    asset_class: AssetClass = Field(description="The category of asset")
    asset_name: str = Field(description="Name of the asset (e.g. 'Reliance Industries Ltd')")
    ticker: Optional[str] = Field(default=None, description="Market ticker symbol (e.g. 'RELIANCE.NS')")
    quantity: float = Field(description="Quantity held (shares, units, or grams)")
    average_cost_inr: float = Field(description="Average purchase price in INR")
    
    current_value_inr: Optional[float] = Field(default=None, description="Total current value in INR")
    current_price_inr: Optional[float] = Field(default=None, description="Current price per unit in INR")
    
    currency: str = Field(default="INR", description="Original currency of purchase/statement")
    exchange: Optional[str] = Field(default=None, description="Exchange trading the asset (NSE, BSE, NYSE, PHYSICAL)")
    source: str = Field(description="Source of data ingestion (KITE, GROWW, FIDELITY, MS, MANUAL)")
    
    # Mutual Fund specific fields
    folio_number: Optional[str] = Field(default=None, description="Folio number for mutual funds")
    fund_category: Optional[str] = Field(default=None, description="Fund classification (e.g. Large Cap, Flexi Cap)")
    scheme_type: Optional[str] = Field(default=None, description="Direct or Regular scheme")
    
    # RSU specific fields
    grant_id: Optional[str] = Field(default=None, description="Equity grant identifier")
    vest_date: Optional[date] = Field(default=None, description="Vesting date of the grant")
    is_vested: Optional[bool] = Field(default=None, description="True if vested, False if unvested")
    
    # General metadata
    sector: Optional[str] = Field(default=None, description="Economic sector (e.g. IT, Banking, Energy)")
    is_active: bool = Field(default=True, description="Flag for soft deletion or replacement")
    notes: Optional[str] = Field(default=None, description="Manual user comments")
    
    last_price_updated_at: Optional[datetime] = Field(default=None, description="Timestamp of last yfinance price refresh")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
