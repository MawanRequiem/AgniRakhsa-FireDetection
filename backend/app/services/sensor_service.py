"""
Sensor Service — IoT data ingestion and queries.

Handles batch sensor reading ingestion from IoT devices,
reading queries with time-range filters, and sensor management.
"""

import logging
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.core.db import supabase

logger = logging.getLogger(__name__)


async def ingest_readings(device_id: UUID, readings: list[dict]) -> int:
    """
    Ingest a batch of sensor readings from an IoT device.
    
    Args:
        device_id: Source device ID (used to update last_seen).
        readings: List of dicts with sensor_id, value, reading_at.
        
    Returns:
        Number of readings successfully stored.
    """
    # Prepare rows for batch insert
    rows = []
    for r in readings:
        row = {
            "sensor_id": str(r["sensor_id"]),
            "value": r["value"],
        }
        if r.get("reading_at"):
            row["reading_at"] = r["reading_at"]
        rows.append(row)
    
    if not rows:
        return 0
    
    # Batch insert readings
    result = supabase.table("sensor_readings").insert(rows).execute()
    inserted_count = len(result.data) if result.data else 0
    
    # Update device last_seen
    supabase.table("devices").update(
        {"last_seen": datetime.utcnow().isoformat(), "status": "online"}
    ).eq("id", str(device_id)).execute()
    
    # Update each sensor's current_value and last_update
    for r in readings:
        supabase.table("sensors").update({
            "current_value": r["value"],
            "last_update": datetime.utcnow().isoformat(),
        }).eq("id", str(r["sensor_id"])).execute()
    
    logger.info(f"Ingested {inserted_count} readings from device {device_id}")
    return inserted_count


async def get_readings(
    sensor_id: Optional[UUID] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """
    Query sensor readings with optional filters.
    
    Args:
        sensor_id: Filter by specific sensor.
        start_time: Readings after this time.
        end_time: Readings before this time.
        page: Page number (1-indexed).
        page_size: Items per page.
        
    Returns:
        Dict with items, total, page, page_size.
    """
    offset = (page - 1) * page_size
    
    query = supabase.table("sensor_readings").select("*", count="exact")
    
    if sensor_id:
        query = query.eq("sensor_id", str(sensor_id))
    if start_time:
        query = query.gte("reading_at", start_time.isoformat())
    if end_time:
        query = query.lte("reading_at", end_time.isoformat())
    
    result = (
        query
        .order("reading_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    
    return {
        "items": result.data or [],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


async def get_latest_reading(sensor_id: UUID) -> dict | None:
    """Get the most recent reading for a sensor."""
    result = (
        supabase.table("sensor_readings")
        .select("*")
        .eq("sensor_id", str(sensor_id))
        .order("reading_at", desc=True)
        .limit(1)
        .execute()
    )
    
    if result.data:
        return result.data[0]
    return None


async def get_all_sensors(room_id: Optional[UUID] = None) -> list[dict]:
    """List all registered sensors, optionally filtered by room."""
    query = supabase.table("sensors").select("*")
    
    if room_id:
        query = query.eq("room_id", str(room_id))
    
    result = query.order("sensor_type").execute()
    return result.data or []


async def get_room_sensor_snapshot(room_id: UUID) -> dict:
    """
    Get a snapshot of all current sensor values for a room.
    Used by the fusion engine to build sensor_snapshot JSONB.
    
    Returns:
        Dict mapping sensor_type -> {value, unit, sensor_id}
    """
    sensors = await get_all_sensors(room_id=room_id)
    
    snapshot = {}
    for s in sensors:
        snapshot[s["sensor_type"]] = {
            "value": s.get("current_value"),
            "unit": s.get("unit"),
            "sensor_id": s["id"],
            "last_update": s.get("last_update"),
        }
    
    return snapshot
