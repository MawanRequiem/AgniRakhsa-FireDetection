"""Room API schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class RoomCreate(BaseModel):
    """Create a new room."""
    name: str = Field(..., min_length=1, max_length=100)
    floor: Optional[str] = None
    building_name: Optional[str] = None
    description: Optional[str] = None


class RoomUpdate(BaseModel):
    """Update room fields."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    floor: Optional[str] = None
    building_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class RoomOut(BaseModel):
    """Room as returned by the API."""
    id: UUID
    name: str
    floor: Optional[str] = None
    building_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "safe"
    created_at: Optional[datetime] = None


class RoomDetail(RoomOut):
    """Room with related sensor and device data."""
    devices: list[dict] = Field(default_factory=list, description="Devices in this room")
    latest_detections: list[dict] = Field(default_factory=list, description="Recent detection events")
    active_alerts: list[dict] = Field(default_factory=list, description="Unacknowledged alerts")
    sensor_count: int = 0
