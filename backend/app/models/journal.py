from enum import Enum
from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field


class SuggestionType(str, Enum):
    """Actions recommended by the AI agent."""
    BUY = "BUY"
    REDUCE = "REDUCE"
    REBALANCE = "REBALANCE"
    FLAG = "FLAG"
    HOLD = "HOLD"
    WATCH = "WATCH"


class ActionTaken(str, Enum):
    """User response to the suggestion."""
    YES = "YES"
    NO = "NO"
    PARTIAL = "PARTIAL"


class OutcomeAssessment(str, Enum):
    """Evaluation of the advice's effectiveness at the review boundary."""
    GOOD = "GOOD"
    NEUTRAL = "NEUTRAL"
    BAD = "BAD"


class SuggestionJournal(SQLModel, table=True):
    """Stores recommendations, user execution records, and retrospective feedback.
    
    This is the core model that enables the AI agent to 'learn' from past advice.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    suggestion_date: date = Field(description="Date the suggestion was generated")
    review_type: str = Field(description="Context: MONTHLY, FLAG, CAPITAL_DEPLOY")
    suggestion_type: SuggestionType = Field(description="The type of action suggested")
    
    asset_class: Optional[str] = Field(default=None, description="Affected asset class")
    asset_name: Optional[str] = Field(default=None, description="Affected asset name")
    suggestion_text: str = Field(description="The complete human-readable advice")
    reasoning: str = Field(description="Detailed logic behind the suggestion")
    
    market_context: Optional[str] = Field(default=None, description="JSON string of prices and news at the time of advice")
    confidence_level: str = Field(default="MEDIUM", description="LOW, MEDIUM, or HIGH")
    urgency: str = Field(default="LOW", description="LOW, MEDIUM, or HIGH")
    tax_note: Optional[str] = Field(default=None, description="LTCG/STCG tax implications or tax advice")

    # User response (submitted via UI)
    action_taken: Optional[ActionTaken] = Field(default=None, description="Whether the user acted on the suggestion")
    action_date: Optional[date] = Field(default=None, description="When the user executed the action")
    action_notes: Optional[str] = Field(default=None, description="User comments on execution")

    # Scheduled boundary for outcome evaluation (typically 1st day of next month)
    review_date: date = Field(description="Date this suggestion is scheduled to be evaluated")

    # Portfolio baseline at time of suggestion
    portfolio_value_at_suggestion: Optional[float] = Field(default=None, description="Total net worth at suggestion time")
    asset_value_at_suggestion: Optional[float] = Field(default=None, description="Specific asset value at suggestion time")

    # Outcome tracking (populated by agent on next monthly review)
    asset_value_at_review: Optional[float] = Field(default=None, description="Asset value at evaluation time")
    outcome_pct_change: Optional[float] = Field(default=None, description="Percentage change in asset value")
    outcome_assessment: Optional[OutcomeAssessment] = Field(default=None, description="GOOD, NEUTRAL, or BAD result")
    agent_retrospective: Optional[str] = Field(default=None, description="Agent's self-reflection on this recommendation")
    lesson_learned: Optional[str] = Field(default=None, description="Specific adjustments to future analysis guidelines")

    is_reviewed: bool = Field(default=False, description="True if the outcome has been evaluated")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
