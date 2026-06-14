"""Sensor and IoT data ingestion API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
import io
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone

from app.schemas.sensor import (
    SensorReadingBatch, SensorReadingsResponse, SensorOut, SensorLatest
)
from app.services import sensor_service
from app.api.deps import CurrentUser, OptionalUser, get_subscribed_room_ids, verify_device_key
from app.core.db import supabase

router = APIRouter(prefix="/sensors", tags=["sensors"])


def _resolve_sensor_room_id(sensor_id: str) -> str | None:
    """Resolve the room_id for a given sensor by joining through devices."""
    res = (
        supabase.table("sensors")
        .select("device_id")
        .eq("id", sensor_id)
        .execute()
    )
    if not res.data:
        return None
    device_id = res.data[0].get("device_id")
    if not device_id:
        return None
    dev_res = (
        supabase.table("devices")
        .select("room_id")
        .eq("id", device_id)
        .execute()
    )
    if not dev_res.data:
        return None
    return dev_res.data[0].get("room_id")


def _check_sensor_access(user: OptionalUser, sensor_id: str | None = None, room_id: str | None = None) -> bool:
    """Returns True if user can access this sensor/room."""
    if user is None or user.role == "admin":
        return True
    subscribed = get_subscribed_room_ids(user.id)
    if room_id:
        return room_id in subscribed
    if sensor_id:
        rid = _resolve_sensor_room_id(sensor_id)
        return rid is not None and rid in subscribed
    return False


@router.post("/readings/batch")
async def ingest_sensor_batch(
    batch: SensorReadingBatch,
    api_key: str = Depends(verify_device_key)
):
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
    user: OptionalUser = None,
):
    """Query historical sensor readings with filters.
    Basic users can only read sensors in subscribed rooms.
    """
    if sensor_id and not _check_sensor_access(user, sensor_id=str(sensor_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this sensor",
        )

    return await sensor_service.get_readings(
        sensor_id=sensor_id,
        start_time=start_time,
        end_time=end_time,
        page=page,
        page_size=page_size,
    )


@router.get("/{sensor_id}/latest", response_model=SensorLatest)
async def get_latest_sensor_reading(sensor_id: UUID, user: OptionalUser = None):
    """Get the most recent reading for a specific sensor.
    Basic users can only access sensors in subscribed rooms.
    """
    # Get sensor metadata
    result = supabase.table("sensors").select("*").eq("id", str(sensor_id)).execute()
    if not result.data:
        raise HTTPException(404, "Sensor not found")

    sensor_data = result.data[0]

    if not _check_sensor_access(user, sensor_id=str(sensor_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this sensor",
        )

    # Get latest reading
    latest = await sensor_service.get_latest_reading(sensor_id)

    return {"sensor": sensor_data, "latest_reading": latest}


@router.get("/history")
async def get_sensor_history(
    device_id: Optional[UUID] = None,
    room_id: Optional[UUID] = None,
    minutes: int = Query(30, ge=1, le=1440),
    user: OptionalUser = None,
):
    """
    Chart-optimized time-series sensor data.
    Basic users must pass a subscribed room_id; otherwise request is rejected.
    """
    if user is not None and user.role == "user":
        if room_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Basic users must provide a room_id",
            )
        if not _check_sensor_access(user, room_id=str(room_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not subscribed to this room",
            )

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
    Basic users can only export subscribed rooms.
    """
    if current_user.role == "user":
        if room_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Basic users must provide a room_id",
            )
        subscribed = get_subscribed_room_ids(current_user.id)
        if str(room_id) not in subscribed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not subscribed to this room",
            )

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
    user: OptionalUser = None,
):
    """
    Diagnose sensor health based on recent readings.
    Basic users must restrict query to subscribed room_id or sensor_id.
    """
    if user is not None and user.role == "user":
        if room_id and not _check_sensor_access(user, room_id=str(room_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not subscribed to this room",
            )
        if sensor_id and not _check_sensor_access(user, sensor_id=str(sensor_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to access this sensor",
            )
        if not room_id and not sensor_id and not device_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Basic users must filter by room_id or sensor_id",
            )

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


@router.get("", response_model=list[SensorOut])
@router.get("/", response_model=list[SensorOut])
async def list_sensors(
    room_id: Optional[UUID] = None,
    user: OptionalUser = None,
):
    """List all registered sensors.
    For basic users, filters to sensors in subscribed rooms.
    """
    if user is not None and user.role == "user":
        if room_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Basic users must provide a room_id",
            )
        if not _check_sensor_access(user, room_id=str(room_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not subscribed to this room",
            )

    return await sensor_service.get_all_sensors(room_id=room_id)
