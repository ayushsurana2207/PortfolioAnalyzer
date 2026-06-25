from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class AppSetting(SQLModel, table=True):
    """A generic key-value store for application-wide configurations and thresholds.
    
    Allows customizing alerting levels, review days, and risk targets dynamically.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True, description="Configuration setting name (e.g. 'drawdown_alert_pct')")
    value: str = Field(description="Configuration value stored as a string")
    description: Optional[str] = Field(default=None, description="Explains what this threshold or setting controls")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last modification timestamp")
