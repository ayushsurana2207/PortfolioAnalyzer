import logging
from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.database import get_session
from app.models.journal import SuggestionJournal, ActionTaken, OutcomeAssessment

logger = logging.getLogger("router_journal")
router = APIRouter(prefix="/journal", tags=["Suggestion Journal"])


class JournalUpdateRequest(BaseModel):
    action_taken: ActionTaken
    action_date: Optional[date] = None
    action_notes: Optional[str] = None


class JournalStats(BaseModel):
    total: int
    acted_yes: int
    acted_no: int
    acted_partial: int
    outcome_good: int
    outcome_neutral: int
    outcome_bad: int


@router.get("", response_model=List[SuggestionJournal])
def get_journal_entries(
    limit: int = 50,
    type: Optional[str] = None,
    outcome: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """Retrieves list of filtered suggestion journal entries, ordered by date descending."""
    query = select(SuggestionJournal)
    
    if type:
        query = query.where(SuggestionJournal.review_type == type.upper())
    if outcome:
        query = query.where(SuggestionJournal.outcome_assessment == outcome.upper())
        
    query = query.order_by(SuggestionJournal.suggestion_date.desc()).limit(limit)
    return session.exec(query).all()


@router.patch("/{entry_id}", response_model=SuggestionJournal)
def update_journal_entry_action(
    entry_id: int,
    request: JournalUpdateRequest,
    session: Session = Depends(get_session)
):
    """Updates a journal entry with the user's action and execution comments."""
    entry = session.get(SuggestionJournal, entry_id)
    if not entry:
        raise HTTPException(
            status_code=404,
            detail=f"Journal entry with ID {entry_id} not found."
        )
        
    entry.action_taken = request.action_taken
    # Use provided action date, fallback to today if YES/PARTIAL but not specified
    if request.action_date:
        entry.action_date = request.action_date
    elif request.action_taken in (ActionTaken.YES, ActionTaken.PARTIAL):
        entry.action_date = date.today()
    else:
        entry.action_date = None
        
    entry.action_notes = request.action_notes
    entry.updated_at = datetime.utcnow()
    
    session.add(entry)
    session.commit()
    session.refresh(entry)
    
    logger.info(f"Updated user action on journal entry {entry_id}: {request.action_taken}")
    return entry


@router.get("/stats", response_model=JournalStats)
def get_journal_statistics(session: Session = Depends(get_session)):
    """Computes total counts, user action ratios, and performance metrics for historical advice."""
    
    # helper query to run counts
    def get_count(clause):
        return session.exec(select(func.count()).select_from(SuggestionJournal).where(clause)).one()
        
    total = session.exec(select(func.count()).select_from(SuggestionJournal)).one()
    
    acted_yes = get_count(SuggestionJournal.action_taken == ActionTaken.YES)
    acted_no = get_count(SuggestionJournal.action_taken == ActionTaken.NO)
    acted_partial = get_count(SuggestionJournal.action_taken == ActionTaken.PARTIAL)
    
    outcome_good = get_count(SuggestionJournal.outcome_assessment == OutcomeAssessment.GOOD)
    outcome_neutral = get_count(SuggestionJournal.outcome_assessment == OutcomeAssessment.NEUTRAL)
    outcome_bad = get_count(SuggestionJournal.outcome_assessment == OutcomeAssessment.BAD)
    
    return JournalStats(
        total=total,
        acted_yes=acted_yes,
        acted_no=acted_no,
        acted_partial=acted_partial,
        outcome_good=outcome_good,
        outcome_neutral=outcome_neutral,
        outcome_bad=outcome_bad
    )
