"""Sensor and IoT data ingestion API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.schemas.sensor import (
    SensorReadingBatch, SensorReadingsResponse, SensorOut, SensorLatest
)
from app.services import sensor_service
from app.api.deps import CurrentUser
from app.core.db import supabase

router = APIRouter(prefix="/sensors", tags=["sensors"])


@router.post("/readings/batch")
async def ingest_sensor_batch(batch: SensorReadingBatch):
    """
    Ingest a batch of sensor readings from an IoT device.
    (e.g., from an ESP32 sending MQ2, MQ4, etc. data every few seconds).
    """
    count = await sensor_service.ingest_readings(
        device_id=batch.device_id,
        readings=[r.model_dump(mode='json') for r in batch.readings]
    )
    return {"message": f"Successfully ingested {count} readings", "count": count}


@router.get("/readings", response_model=SensorReadingsResponse)
async def get_sensor_readings(
    sensor_id: Optional[UUID] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
):
    """Query historical sensor readings with filters."""
    return await sensor_service.get_readings(
        sensor_id=sensor_id,
        start_time=start_time,
        end_time=end_time,
        page=page,
        page_size=page_size,
    )


@router.get("/{sensor_id}/latest", response_model=SensorLatest)
async def get_latest_sensor_reading(sensor_id: UUID):
    """Get the most recent reading for a specific sensor."""
    # Get sensor metadata
    result = supabase.table("sensors").select("*").eq("id", str(sensor_id)).execute()
    if not result.data:
        raise HTTPException(404, "Sensor not found")
    
    sensor_data = result.data[0]
    
    # Get latest reading
    latest = await sensor_service.get_latest_reading(sensor_id)
    
    return {"sensor": sensor_data, "latest_reading": latest}


@router.get("/history")
async def get_sensor_history(
    device_id: Optional[UUID] = None,
    room_id: Optional[UUID] = None,
    minutes: int = Query(30, ge=1, le=1440),
):
    """
    Chart-optimized time-series sensor data.

    Returns data grouped by timestamp with each sensor type as a field,
    ready for direct consumption by Recharts or similar charting libraries.
    """
    return await sensor_service.get_chart_history(
        device_id=device_id,
        room_id=room_id,
        minutes=minutes,
    )


@router.get("/health")
async def check_sensor_health(
    sensor_id: Optional[UUID] = None,
    room_id: Optional[UUID] = None,
    device_id: Optional[UUID] = None,
    window_minutes: int = Query(5, ge=1, le=60),
):
    """
    Diagnose sensor health based on recent readings.

    Detects broken, stuck, dead, saturated, erratic, and stale sensors.
    Filter by sensor_id, room_id, or device_id.
    If no filter is provided, checks ALL sensors.
    """
    results = await sensor_service.diagnose_sensor_health(
        sensor_id=sensor_id,
        room_id=room_id,
        device_id=device_id,
        window_minutes=window_minutes,
    )

    # Summary counts
    status_counts = {}
    for r in results:
        s = r["status"]
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        "total": len(results),
        "summary": status_counts,
        "sensors": results,
    }


@router.get("/", response_model=list[SensorOut])
async def list_sensors(room_id: Optional[UUID] = None):
    """List all registered sensors."""
    return await sensor_service.get_all_sensors(room_id=room_id)

