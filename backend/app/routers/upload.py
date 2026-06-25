import json
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models.holding import Holding
from app.models.pdf_upload import PDFUpload, UploadType
from app.services.pdf_parser import parse_pdf, map_to_holdings
from app.services.prices import get_usd_inr_rate

logger = logging.getLogger("router_upload")
router = APIRouter(prefix="/upload", tags=["Statement Uploads"])


class UploadResponse(BaseModel):
    upload_id: int
    parsed_items_count: int
    holdings_preview: List[Holding]


@router.post("/pdf", response_model=UploadResponse)
async def upload_portfolio_pdf(
    file: UploadFile = File(...),
    upload_type: str = Form(...),
    period: str = Form(...),
    session: Session = Depends(get_session)
):
    """Ingests and parses investment statement PDFs, updating the active holdings database."""
    
    # 1. Validate file format
    if not file.filename.lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only PDF files are supported."
        )
        
    # 2. Validate upload type
    try:
        u_type = UploadType(upload_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid upload_type '{upload_type}'. Supported values are: "
                f"{[e.value for e in UploadType]}"
            )
        )

    # 3. Read file bytes
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # 4. Fetch live exchange rate
    usd_inr_rate = await get_usd_inr_rate()

    # Create placeholder log in case of unexpected failure
    pdf_upload = PDFUpload(
        filename=file.filename,
        upload_type=u_type,
        period=period,
        parsing_status="PENDING",
        parsed_items_count=0
    )
    
    try:
        # 5. Invoke LLM parser
        parsed_data = await parse_pdf(file_bytes, u_type)
        
        # 6. Map to Holding model instances
        new_holdings = map_to_holdings(parsed_data, u_type, usd_inr_rate)
        
        # 7. Identify the data source to perform a clean refresh
        source_mapping = {
            UploadType.ONBOARD_RSU_FIDELITY: "FIDELITY",
            UploadType.MONTHLY_RSU_FIDELITY: "FIDELITY",
            UploadType.ONBOARD_RSU_MS: "MS",
            UploadType.MONTHLY_RSU_MS: "MS",
            UploadType.ONBOARD_MF_GROWW: "GROWW",
            UploadType.MONTHLY_MF_GROWW: "GROWW",
            UploadType.ONBOARD_STOCKS_KITE: "KITE",
            UploadType.MONTHLY_STOCKS_KITE: "KITE",
        }
        source = source_mapping[u_type]
        
        # Soft-delete all existing active holdings from this source
        existing_holdings = session.exec(
            select(Holding)
            .where(Holding.source == source)
            .where(Holding.is_active == True)
        ).all()
        
        for eh in existing_holdings:
            eh.is_active = False
            eh.updated_at = datetime_now()
            session.add(eh)
            
        # Add the newly parsed holdings
        for nh in new_holdings:
            session.add(nh)
            
        # Update upload tracking record
        pdf_upload.parsing_status = "SUCCESS"
        pdf_upload.parsed_items_count = len(new_holdings)
        pdf_upload.raw_extracted_json = json.dumps(parsed_data)
        
        session.add(pdf_upload)
        session.commit()
        
        # Refresh holdings to populate IDs in response
        for nh in new_holdings:
            session.refresh(nh)
            
        logger.info(f"Successfully processed upload '{file.filename}' of type {u_type}. Parsed {len(new_holdings)} holdings.")
        
        return UploadResponse(
            upload_id=pdf_upload.id,
            parsed_items_count=len(new_holdings),
            holdings_preview=new_holdings
        )

    except Exception as e:
        logger.error(f"Error occurred during PDF upload/parsing pipeline: {e}")
        
        # Record failure event in database
        pdf_upload.parsing_status = "FAILED"
        pdf_upload.error_message = str(e)
        
        session.add(pdf_upload)
        session.commit()
        
        raise HTTPException(
            status_code=400,
            detail=f"Statement parsing failed: {str(e)}"
        )


@router.get("/history", response_model=List[PDFUpload])
def get_upload_history(session: Session = Depends(get_session)):
    """Returns a list of all PDF upload events, sorted with the most recent first."""
    return session.exec(
        select(PDFUpload)
        .order_by(PDFUpload.created_at.desc())
    ).all()


def datetime_now() -> datetime:
    """Helper to get current UTC datetime."""
    return datetime.utcnow()
