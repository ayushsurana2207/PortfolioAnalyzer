from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field


class PortfolioSnapshot(SQLModel, table=True):
    """Captures a historical snapshot of the entire portfolio value and allocation.
    
    Used to track net worth and asset class allocation history over time.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    snapshot_date: date = Field(description="The date of the snapshot (usually the end or start of a month)")
    snapshot_type: str = Field(default="MONTHLY", description="Type of snapshot: MONTHLY, DAILY, MANUAL")
    
    total_value_inr: float = Field(description="Total net worth (vested assets only) in INR")
    
    # Asset class aggregates
    stocks_value_inr: float = Field(default=0, description="Total value of Indian equities in INR")
    mf_value_inr: float = Field(default=0, description="Total value of Mutual Funds in INR")
    gold_value_inr: float = Field(default=0, description="Total value of Gold in INR")
    silver_value_inr: float = Field(default=0, description="Total value of Silver in INR")
    rsu_google_value_inr: float = Field(default=0, description="Total value of Google vested RSUs in INR")
    rsu_oracle_value_inr: float = Field(default=0, description="Total value of Oracle vested RSUs in INR")
    
    # Unvested RSU value is tracked for information but excluded from net worth calculations
    unvested_rsu_value_inr: float = Field(default=0, description="Total value of unvested RSUs (informational only)")
    
    # Portfolio concentration
    tech_concentration_pct: float = Field(default=0, description="Percentage of vested portfolio exposed to Tech sector")
    
    # Forex context
    usd_inr_rate: float = Field(description="USD/INR exchange rate at the time of the snapshot")
    
    notes: Optional[str] = Field(default=None, description="Metadata or summary notes about this snapshot")
    created_at: datetime = Field(default_factory=datetime.utcnow)
