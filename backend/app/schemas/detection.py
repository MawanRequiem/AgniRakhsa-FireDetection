"""Detection API request/response schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class DetectionRequest(BaseModel):
    """Optional metadata sent alongside an image upload."""
    device_id: Optional[UUID] = Field(default=None, description="Source IoT device ID")
    room_id: Optional[UUID] = Field(default=None, description="Room where image was captured")


class DetectionBBox(BaseModel):
    """Single detection bounding box in API response."""
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_name: str
    class_id: int


class DetectionResponse(BaseModel):
    """Response from the detection endpoint."""
    id: UUID = Field(..., description="Detection event ID (stored in DB)")
    detections: list[DetectionBBox] = Field(default_factory=list)
    max_confidence: float = Field(default=0.0)
    detection_class: Optional[str] = None
    model_name: str
    model_version: str
    processing_time_ms: int
    image_width: int
    image_height: int
    risk_assessment: Optional["RiskAssessment"] = None
    created_at: datetime


class RiskAssessment(BaseModel):
    """Risk assessment from fusion (included when sensor data is available)."""
    fusion_score: float = Field(..., ge=0.0, le=1.0)
    risk_level: str = Field(..., description="safe, low, medium, high, critical")
    image_score: float
    sensor_score: float


class DetectionHistoryItem(BaseModel):
    """Single item in detection history list."""
    id: UUID
    room_id: Optional[UUID] = None
    device_id: Optional[UUID] = None
    model_name: str
    max_confidence: float
    detection_class: Optional[str] = None
    processing_time_ms: int
    image_url: Optional[str] = None
    created_at: datetime


class DetectionHistoryResponse(BaseModel):
    """Paginated detection history."""
    items: list[DetectionHistoryItem]
    total: int
    page: int
    page_size: int


# Rebuild to resolve forward reference
DetectionResponse.model_rebuild()
