import logging
from datetime import datetime
from typing import Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models.settings import AppSetting
from app.services.notifications import send_test_notification

logger = logging.getLogger("router_settings")
router = APIRouter(prefix="/settings", tags=["AppSettings"])


@router.get("", response_model=Dict[str, str])
def get_all_settings(session: Session = Depends(get_session)):
    """Retrieves all application-wide configurations as a key-value dictionary."""
    settings_list = session.exec(select(AppSetting)).all()
    return {s.key: s.value for s in settings_list}


@router.patch("", response_model=Dict[str, str])
def update_settings(
    request: Dict[str, str],
    session: Session = Depends(get_session)
):
    """Batch updates or inserts (upserts) application settings and threshold configurations."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body cannot be empty.")
        
    for key, value in request.items():
        # Clean inputs
        key_clean = key.strip()
        value_clean = value.strip()
        
        # Check if setting already exists
        setting = session.exec(select(AppSetting).where(AppSetting.key == key_clean)).first()
        
        if setting:
            setting.value = value_clean
            setting.updated_at = datetime.utcnow()
            session.add(setting)
        else:
            # Create a new setting
            new_setting = AppSetting(
                key=key_clean,
                value=value_clean,
                description=f"Customized setting for {key_clean}",
                updated_at=datetime.utcnow()
            )
            session.add(new_setting)
            
    session.commit()
    logger.info(f"Successfully updated settings: {list(request.keys())}")
    
    # Return the full updated settings dictionary
    return get_all_settings(session)


@router.post("/test-telegram")
async def trigger_test_notification():
    """Sends a connection and verification test notification.
    
    Note: Named '/test-telegram' to ensure 100% compatibility with the frontend specifications,
    but dispatches a test alert to the configured email inbox.
    """
    try:
        await send_test_notification()
        return {"detail": "Test email notification dispatched successfully."}
    except Exception as e:
        logger.error(f"Failed to send test email notification: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test notification: {str(e)}"
        )
