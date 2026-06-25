import logging
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.database import get_session
from app.models.holding import Holding, AssetClass
from app.services.prices import get_gold_price_inr_per_gram, get_silver_price_inr_per_gram

logger = logging.getLogger("router_manual")
router = APIRouter(prefix="/manual", tags=["Manual Gold/Silver Entry"])


class ManualHoldingCreate(BaseModel):
    asset_class: AssetClass = Field(description="Must be GOLD or SILVER")
    asset_name: str = Field(description="Friendly name (e.g. 'SGB 2024 Series 1', 'Physical Coins')")
    quantity: float = Field(description="Weight in grams")
    average_cost_inr: float = Field(description="Purchase cost per gram in INR")
    notes: Optional[str] = None


class ManualHoldingUpdate(BaseModel):
    quantity: float = Field(description="Weight in grams")
    notes: Optional[str] = None


@router.post("/holding", response_model=Holding)
async def create_manual_holding(
    request: ManualHoldingCreate,
    session: Session = Depends(get_session)
):
    """Onboards a manual gold or silver precious metal holding.
    
    Automatically queries live COMEX spot prices per gram and calculates the initial valuation.
    """
    if request.asset_class not in (AssetClass.GOLD, AssetClass.SILVER):
        raise HTTPException(
            status_code=400,
            detail="Manual entries only support GOLD or SILVER asset classes."
        )
        
    if request.quantity <= 0 or request.average_cost_inr <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity and cost must be positive numbers."
        )

    # Fetch live spot price to value the asset immediately
    live_price = request.average_cost_inr  # fallback
    try:
        if request.asset_class == AssetClass.GOLD:
            live_price = await get_gold_price_inr_per_gram()
        else:
            live_price = await get_silver_price_inr_per_gram()
        logger.info(f"Retrieved spot price for manual {request.asset_class}: ₹{live_price:,.2f}/g")
    except Exception as e:
        logger.warning(f"Could not fetch live price for manual asset: {e}. Falling back to purchase cost.")

    new_holding = Holding(
        asset_class=request.asset_class,
        asset_name=request.asset_name,
        ticker=None,
        quantity=request.quantity,
        average_cost_inr=request.average_cost_inr,
        current_price_inr=live_price,
        current_value_inr=live_price * request.quantity,
        currency="INR",
        exchange="PHYSICAL",
        source="MANUAL",
        is_active=True,
        notes=request.notes,
        last_price_updated_at=datetime.utcnow()
    )

    session.add(new_holding)
    session.commit()
    session.refresh(new_holding)
    
    logger.info(f"Manually added holding: {request.asset_name} ({request.quantity}g)")
    return new_holding


@router.get("/holdings", response_model=List[Holding])
def get_manual_holdings(session: Session = Depends(get_session)):
    """Returns a list of all active manual precious metal holdings."""
    return session.exec(
        select(Holding)
        .where(Holding.source == "MANUAL")
        .where(Holding.is_active == True)
    ).all()


@router.put("/holding/{holding_id}", response_model=Holding)
def update_manual_holding(
    holding_id: int,
    request: ManualHoldingUpdate,
    session: Session = Depends(get_session)
):
    """Updates the weight or notes of an existing manual holding, recalculating the valuation."""
    holding = session.get(Holding, holding_id)
    if not holding or holding.source != "MANUAL" or not holding.is_active:
        raise HTTPException(
            status_code=404,
            detail=f"Active manual holding with ID {holding_id} not found."
        )
        
    if request.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be a positive number."
        )

    holding.quantity = request.quantity
    holding.notes = request.notes
    
    # Recalculate total value based on the last known unit price
    if holding.current_price_inr:
        holding.current_value_inr = holding.current_price_inr * request.quantity
        
    holding.updated_at = datetime.utcnow()
    
    session.add(holding)
    session.commit()
    session.refresh(holding)
    
    logger.info(f"Updated manual holding {holding_id}: new quantity={request.quantity}g")
    return holding


@router.delete("/holding/{holding_id}")
def delete_manual_holding(holding_id: int, session: Session = Depends(get_session)):
    """Soft-deletes a manual holding by setting is_active to False."""
    holding = session.get(Holding, holding_id)
    if not holding or holding.source != "MANUAL" or not holding.is_active:
        raise HTTPException(
            status_code=404,
            detail=f"Active manual holding with ID {holding_id} not found."
        )
        
    holding.is_active = False
    holding.updated_at = datetime.utcnow()
    
    session.add(holding)
    session.commit()
    
    logger.info(f"Soft-deleted manual holding {holding_id}: '{holding.asset_name}'")
    return {"detail": "Holding successfully deleted."}
