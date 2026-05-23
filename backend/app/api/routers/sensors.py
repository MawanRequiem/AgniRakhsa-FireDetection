"""Sensor and IoT data ingestion API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
import io
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone

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


@router.get("/export")
async def export_gas_records(
    current_user: CurrentUser,
    room_id: Optional[UUID] = Query(None),
    device_id: Optional[UUID] = Query(None),
    preset: Optional[str] = Query("24h"),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
):
    """
    Export historical gas records as a downloadable Excel-compatible CSV file.
    Supports customizable presets (1h, 6h, 24h, 7d, 30d) or dynamic start_time and end_time.
    """
    now = datetime.now(timezone.utc)
    
    if preset == "1h":
        start_time = now - timedelta(hours=1)
        end_time = now
    elif preset == "6h":
        start_time = now - timedelta(hours=6)
        end_time = now
    elif preset == "24h":
        start_time = now - timedelta(hours=24)
        end_time = now
    elif preset == "7d":
        start_time = now - timedelta(days=7)
        end_time = now
    elif preset == "30d":
        start_time = now - timedelta(days=30)
        end_time = now
    elif preset == "custom":
        if not start_time or not end_time:
            raise HTTPException(
                status_code=400,
                detail="Custom range requires both start_time and end_time parameters."
            )
    else:
        # Default to 24h
        start_time = now - timedelta(hours=24)
        end_time = now

    csv_data = await sensor_service.export_sensor_readings_to_csv(
        room_id=room_id,
        device_id=device_id,
        start_time=start_time,
        end_time=end_time,
    )

    stream = io.StringIO(csv_data)
    
    filename = f"gas_records_{preset}"
    if room_id:
        filename += f"_room_{str(room_id)[:8]}"
    elif device_id:
        filename += f"_device_{str(device_id)[:8]}"
    filename += f"_{now.strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Cache-Control": "no-cache",
        }
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

