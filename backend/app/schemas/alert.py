"""Alert API schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class AlertOut(BaseModel):
    """Alert as returned by the API."""
    id: UUID
    room_id: Optional[UUID] = None
    fusion_result_id: Optional[UUID] = None
    severity: str
    alert_type: str = "fire"
    message: str
    is_acknowledged: bool = False
    acknowledged_by: Optional[UUID] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime


class AlertAcknowledge(BaseModel):
    """Acknowledge an alert."""
    note: Optional[str] = Field(default=None, max_length=500, description="Optional acknowledgement note")


class AlertsResponse(BaseModel):
    """Paginated alerts list."""
    items: list[AlertOut]
    total: int
    page: int
    page_size: int
