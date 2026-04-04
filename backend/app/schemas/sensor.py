"""Sensor and sensor reading API schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class SensorOut(BaseModel):
    """Sensor metadata."""
    id: UUID
    device_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    sensor_type: str
    current_value: Optional[float] = None
    unit: Optional[str] = None
    status: str = "active"
    last_update: Optional[datetime] = None


class SensorReadingCreate(BaseModel):
    """A single sensor reading from an IoT device."""
    sensor_id: UUID = Field(..., description="Registered sensor ID")
    value: float = Field(..., description="Reading value (ppm, °C, %, raw)")
    reading_at: Optional[datetime] = Field(default=None, description="Timestamp of the reading. Defaults to now().")


class SensorReadingBatch(BaseModel):
    """Batch of sensor readings (from a single IoT device heartbeat)."""
    device_id: UUID = Field(..., description="Source device ID")
    readings: list[SensorReadingCreate] = Field(..., min_length=1, max_length=50)


class SensorReadingOut(BaseModel):
    """A sensor reading as returned by the API."""
    id: int
    sensor_id: UUID
    value: float
    reading_at: datetime
    created_at: datetime


class SensorReadingsResponse(BaseModel):
    """Paginated sensor readings."""
    items: list[SensorReadingOut]
    total: int
    page: int
    page_size: int


class SensorLatest(BaseModel):
    """Latest reading for a single sensor with metadata."""
    sensor: SensorOut
    latest_reading: Optional[SensorReadingOut] = None
