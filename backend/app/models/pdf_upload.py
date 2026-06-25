from enum import Enum
from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field


class UploadType(str, Enum):
    """Categorizes statement documents by provider and lifecycle stage."""
    ONBOARD_RSU_FIDELITY = "ONBOARD_RSU_FIDELITY"
    ONBOARD_RSU_MS = "ONBOARD_RSU_MS"
    ONBOARD_MF_GROWW = "ONBOARD_MF_GROWW"
    ONBOARD_STOCKS_KITE = "ONBOARD_STOCKS_KITE"
    
    MONTHLY_RSU_FIDELITY = "MONTHLY_RSU_FIDELITY"
    MONTHLY_RSU_MS = "MONTHLY_RSU_MS"
    MONTHLY_MF_GROWW = "MONTHLY_MF_GROWW"
    MONTHLY_STOCKS_KITE = "MONTHLY_STOCKS_KITE"


class PDFUpload(SQLModel, table=True):
    """Logs PDF upload events and tracks parsing success/failure metrics."""
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str = Field(description="Original name of the uploaded PDF file")
    upload_type: UploadType = Field(description="The statement type and role (onboarding vs monthly)")
    upload_date: date = Field(default_factory=date.today, description="Date the document was uploaded")
    period: Optional[str] = Field(default=None, description="The statement period (e.g., 'Jun 2026')")
    
    parsing_status: str = Field(default="PENDING", description="Parsing status: PENDING, SUCCESS, FAILED")
    parsed_items_count: int = Field(default=0, description="Number of holdings parsed out of this document")
    error_message: Optional[str] = Field(default=None, description="Error logs if parsing failed")
    raw_extracted_json: Optional[str] = Field(default=None, description="Verbatim JSON response returned by the LLM parser")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
