"""
Sensor Service — IoT data ingestion and queries.

Handles batch sensor reading ingestion from IoT devices,
reading queries with time-range filters, and sensor management.
"""

import logging
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta

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
    
    now_utc = datetime.now(timezone.utc).isoformat()
    
    # Check if device was previously offline (for status change broadcast)
    device_res = supabase.table("devices").select("status, name").eq("id", str(device_id)).execute()
    was_offline = False
    device_name = ""
    if device_res.data:
        was_offline = device_res.data[0].get("status") != "online"
        device_name = device_res.data[0].get("name", "")
    
    # Update device last_seen and status
    supabase.table("devices").update(
        {"last_seen": now_utc, "status": "online"}
    ).eq("id", str(device_id)).execute()
    
    # Update each sensor's current_value and last_update
    for r in readings:
        supabase.table("sensors").update({
            "current_value": r["value"],
            "last_update": now_utc,
        }).eq("id", str(r["sensor_id"])).execute()
    
    logger.info(f"Ingested {inserted_count} readings from device {device_id}")
    
    # Build sensor_type_map for broadcasting readable sensor types
    sensor_ids = [str(r["sensor_id"]) for r in readings]
    sensor_meta = supabase.table("sensors").select("id, sensor_type").in_("id", sensor_ids).execute()
    sensor_type_map = {s["id"]: s["sensor_type"] for s in (sensor_meta.data or [])}
    
    # Broadcast SENSOR_UPDATE to connected dashboard clients
    from app.api.ws_manager import manager
    await manager.broadcast({
        "type": "SENSOR_UPDATE",
        "data": {
            "device_id": str(device_id),
            "readings": [
                {"sensor_type": sensor_type_map.get(str(r["sensor_id"]), "UNKNOWN"), "value": r["value"]}
                for r in readings
            ],
            "timestamp": now_utc,
        }
    })
    
    # Broadcast DEVICE_STATUS_CHANGE if device just came back online
    if was_offline:
        logger.info(f"Device '{device_name}' ({device_id}) came back ONLINE")
        await manager.broadcast({
            "type": "DEVICE_STATUS_CHANGE",
            "data": {
                "device_id": str(device_id),
                "status": "online",
                "name": device_name,
            }
        })
    
    # Feed sensor anomaly detector buffer (for Isolation Forest ML model)
    try:
        from app.ai import registry
        sensor_detector = registry.get_sensor_detector()
        
        # Look up room_id for this device
        device_room = supabase.table("devices").select("room_id").eq("id", str(device_id)).execute()
        room_id = device_room.data[0].get("room_id") if device_room.data else None
        
        if room_id:
            # Build snapshot: sensor_type → value
            snapshot = {
                sensor_type_map.get(str(r["sensor_id"]), ""): r["value"]
                for r in readings
            }
            # Remove empty-key entries (sensors without metadata)
            snapshot = {k: v for k, v in snapshot.items() if k}
            sensor_detector.ingest(room_id, snapshot)
            logger.debug(
                f"Fed sensor buffer for room {room_id}: {len(snapshot)} sensors, "
                f"buffer={sensor_detector.get_buffer_status().get(room_id, 0)}/9"
            )
    except RuntimeError:
        pass  # Sensor model not loaded — skip buffer feeding
    except Exception as e:
        logger.warning(f"Failed to feed sensor anomaly buffer: {e}")
    
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


async def get_chart_history(
    device_id: Optional[UUID] = None,
    room_id: Optional[UUID] = None,
    minutes: int = 30,
) -> list[dict]:
    """
    Chart-optimized time-series query.

    Returns a flat list of {time, sensor_type, value} rows.
    The frontend pivots these into Recharts-friendly format:
      [{time: "10:05", MQ2: 200, SHTC3_TEMP: 25}, ...]
    """
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)

    # Get sensor IDs scoped to device or room
    sensor_query = supabase.table("sensors").select("id, sensor_type")
    if device_id:
        sensor_query = sensor_query.eq("device_id", str(device_id))
    elif room_id:
        sensor_query = sensor_query.eq("room_id", str(room_id))
    
    sensor_res = sensor_query.execute()
    sensors = sensor_res.data or []
    
    if not sensors:
        return []
    
    sensor_ids = [s["id"] for s in sensors]
    sensor_type_map = {s["id"]: s["sensor_type"] for s in sensors}
    
    # Fetch readings in the time window
    readings_res = (
        supabase.table("sensor_readings")
        .select("sensor_id, value, reading_at")
        .in_("sensor_id", sensor_ids)
        .gte("reading_at", since.isoformat())
        .order("reading_at", desc=False)
        .limit(2000)
        .execute()
    )
    
    readings = readings_res.data or []
    
    # Group by truncated timestamp (to nearest 10 seconds for smoothing)
    from collections import defaultdict
    time_buckets = defaultdict(dict)
    
    for r in readings:
        # Truncate to 10-second bucket
        raw_time = r["reading_at"]
        try:
            dt = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            continue
        
        # Round to 10-second bucket
        bucket_second = (dt.second // 10) * 10
        bucket_dt = dt.replace(second=bucket_second, microsecond=0)
        bucket_key = bucket_dt.isoformat()
        
        sensor_type = sensor_type_map.get(r["sensor_id"], "UNKNOWN")
        
        # Use the latest value in each bucket
        time_buckets[bucket_key][sensor_type] = round(r["value"], 2)
        time_buckets[bucket_key]["_time"] = bucket_key
    
    # Convert to sorted list
    result = sorted(time_buckets.values(), key=lambda x: x.get("_time", ""))
    
    # Rename _time to time for frontend
    for entry in result:
        entry["time"] = entry.pop("_time", "")
    
    return result

