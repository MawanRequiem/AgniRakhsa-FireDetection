"""Calibration API schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class CalibrationData(BaseModel):
    """Sent by ESP32 after calibration to store R0 values on server."""
    calibrated: bool = Field(default=True, description="Whether calibration was successful")
    r0_mq2: Optional[float] = Field(default=None, description="R0 for MQ-2 sensor (kΩ)")
    r0_mq4: Optional[float] = Field(default=None, description="R0 for MQ-4 sensor (kΩ)")
    r0_mq6: Optional[float] = Field(default=None, description="R0 for MQ-6 sensor (kΩ)")
    r0_mq9: Optional[float] = Field(default=None, description="R0 for MQ-9 sensor (kΩ)")
    firmware_version: Optional[str] = Field(default=None, description="Firmware version at calibration time")


class CalibrationOut(BaseModel):
    """Calibration record as returned by the API."""
    id: UUID
    device_id: UUID
    r0_mq2: Optional[float] = None
    r0_mq4: Optional[float] = None
    r0_mq6: Optional[float] = None
    r0_mq9: Optional[float] = None
    firmware_version: Optional[str] = None
    calibrated_at: datetime
    source: str


class CalibrationCommandRequest(BaseModel):
    """Admin request to trigger a remote command on a device."""
    command: str = Field(default="RECALIBRATE", description="Command to send (e.g. RECALIBRATE)")


class CalibrationCommandAck(BaseModel):
    """Device acknowledgment of a completed command."""
    status: str = Field(default="completed", description="Command completion status")


class DeviceCommandOut(BaseModel):
    """Pending command returned to ESP32."""
    command_id: UUID
    command: str
