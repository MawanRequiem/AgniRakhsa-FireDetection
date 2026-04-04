"""Device API schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class DeviceCreate(BaseModel):
    """Register a new IoT device."""
    name: str = Field(..., min_length=1, max_length=100, description="Device display name")
    room_id: Optional[UUID] = Field(default=None, description="Room assignment")
    device_type: str = Field(default="esp32-s3", description="Hardware type")
    mac_address: Optional[str] = Field(default=None, description="Unique MAC address")
    firmware_version: Optional[str] = Field(default=None, description="Current firmware version")


class DeviceUpdate(BaseModel):
    """Update device fields."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    room_id: Optional[UUID] = None
    firmware_version: Optional[str] = None
    status: Optional[str] = None


class DeviceOut(BaseModel):
    """Device as returned by the API."""
    id: UUID
    name: str
    room_id: Optional[UUID] = None
    device_type: str
    mac_address: Optional[str] = None
    firmware_version: Optional[str] = None
    status: str
    last_seen: Optional[datetime] = None
    created_at: datetime


class DeviceHeartbeat(BaseModel):
    """Device heartbeat payload (sent periodically by IoT devices)."""
    firmware_version: Optional[str] = None
    uptime_seconds: Optional[int] = None

class DeviceProvisionRequest(BaseModel):
    """Sent by MCU on boot to self-register and get sensor UUIDs."""
    name: str = Field(..., description="Device name from config")
    mac_address: str = Field(..., description="Device MAC address")
    room_name: Optional[str] = Field(default=None, description="Auto-assign to room by name")
    sensor_types: list[str] = Field(..., description="List of sensor types this device has (e.g. ['MQ2', 'MQ4'])")

class DeviceProvisionResponse(BaseModel):
    """Returned to MCU containing its assigned UUIDs."""
    device_id: UUID
    sensors: dict[str, UUID] = Field(default_factory=dict, description="Map of sensor_type to its UUID")
