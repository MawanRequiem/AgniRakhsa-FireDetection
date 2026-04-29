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


# ─── Sensor Health Diagnostics ────────────────────────────────────────────────
# Expected value ranges per sensor type for sanity checking.
# (absolute_min, absolute_max, adc_max)
# adc_max = raw ADC ceiling that indicates sensor saturation.

SENSOR_EXPECTED_RANGE: dict[str, tuple[float, float, float]] = {
    "MQ2":         (0,    5000,   4095),
    "MQ4":         (0,    5000,   4095),
    "MQ5":         (0,    5000,   4095),
    "MQ6":         (0,    5000,   4095),
    "MQ9B":        (0,    3000,   4095),
    "FLAME":       (0,    4095,   4095),
    "SHTC3_TEMP":  (-40,  125,    None),   # No ADC ceiling for digital sensors
    "SHTC3_HUM":   (0,    100,    None),
}

# Thresholds for health heuristics
STUCK_STD_THRESHOLD = 0.01       # Std dev below this → sensor is stuck
ERRATIC_JUMP_FACTOR = 3.0        # Max jump > factor × mean → erratic
STALE_SECONDS = 120              # No reading within this → stale
MIN_READINGS_FOR_DIAGNOSIS = 5   # Need at least this many readings to diagnose


async def diagnose_sensor_health(
    sensor_id: UUID | None = None,
    room_id: UUID | None = None,
    device_id: UUID | None = None,
    window_minutes: int = 5,
) -> list[dict]:
    """
    Diagnose the health of one or more sensors based on recent readings.

    Checks for:
      - stuck:     values are constant (std ≈ 0)
      - dead:      all values are exactly 0
      - saturated: values pegged at ADC max (4095)
      - erratic:   extreme jumps between consecutive readings
      - stale:     no readings within the time window
      - out_of_range: values outside physically possible bounds
      - healthy:   everything looks normal

    Args:
        sensor_id: Diagnose a single sensor.
        room_id:   Diagnose all sensors in a room.
        device_id: Diagnose all sensors on a device.
        window_minutes: How many minutes of recent data to analyze.

    Returns:
        List of dicts with sensor_id, sensor_type, status, details.
    """
    # 1. Resolve which sensors to check
    query = supabase.table("sensors").select("id, sensor_type, device_id, current_value, last_update")

    if sensor_id:
        query = query.eq("id", str(sensor_id))
    elif room_id:
        query = query.eq("room_id", str(room_id))
    elif device_id:
        query = query.eq("device_id", str(device_id))

    sensor_res = query.execute()
    sensors = sensor_res.data or []

    if not sensors:
        return []

    since = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
    results = []

    for sensor in sensors:
        sid = sensor["id"]
        stype = sensor.get("sensor_type", "UNKNOWN")
        last_update = sensor.get("last_update")
        diagnosis = {
            "sensor_id": sid,
            "device_id": sensor.get("device_id"),
            "sensor_type": stype,
            "status": "healthy",
            "details": {},
        }

        # 2. Check for stale sensor (no recent data)
        if last_update:
            try:
                last_dt = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
                seconds_ago = (datetime.now(timezone.utc) - last_dt).total_seconds()
                diagnosis["details"]["last_seen_seconds_ago"] = round(seconds_ago, 1)

                if seconds_ago > STALE_SECONDS:
                    diagnosis["status"] = "stale"
                    diagnosis["details"]["reason"] = (
                        f"No reading for {round(seconds_ago)}s (threshold: {STALE_SECONDS}s)"
                    )
                    results.append(diagnosis)
                    continue
            except (ValueError, TypeError):
                pass
        else:
            diagnosis["status"] = "stale"
            diagnosis["details"]["reason"] = "Sensor has never reported a reading"
            results.append(diagnosis)
            continue

        # 3. Fetch recent readings for statistical analysis
        readings_res = (
            supabase.table("sensor_readings")
            .select("value, reading_at")
            .eq("sensor_id", sid)
            .gte("reading_at", since.isoformat())
            .order("reading_at", desc=False)
            .limit(200)
            .execute()
        )
        readings = readings_res.data or []

        if len(readings) < MIN_READINGS_FOR_DIAGNOSIS:
            diagnosis["details"]["reading_count"] = len(readings)
            diagnosis["details"]["note"] = "Too few readings for full diagnosis"
            results.append(diagnosis)
            continue

        import numpy as np
        values = np.array([r["value"] for r in readings], dtype=np.float64)
        diagnosis["details"]["reading_count"] = len(values)
        diagnosis["details"]["mean"] = round(float(np.mean(values)), 2)
        diagnosis["details"]["std"] = round(float(np.std(values)), 4)
        diagnosis["details"]["min"] = round(float(np.min(values)), 2)
        diagnosis["details"]["max"] = round(float(np.max(values)), 2)

        # 4. Dead check: all values are exactly 0
        if np.all(values == 0):
            diagnosis["status"] = "dead"
            diagnosis["details"]["reason"] = "All readings are exactly 0 — sensor may be disconnected"
            results.append(diagnosis)
            continue

        # 5. Stuck check: near-zero standard deviation
        if np.std(values) < STUCK_STD_THRESHOLD:
            diagnosis["status"] = "stuck"
            diagnosis["details"]["reason"] = (
                f"Constant value {values[-1]:.1f} across {len(values)} readings "
                f"(std={np.std(values):.6f})"
            )
            results.append(diagnosis)
            continue

        # 6. Saturated check: pegged at ADC max
        expected = SENSOR_EXPECTED_RANGE.get(stype)
        if expected and expected[2] is not None:
            adc_max = expected[2]
            saturated_pct = float(np.sum(values >= adc_max)) / len(values)
            if saturated_pct > 0.8:
                diagnosis["status"] = "saturated"
                diagnosis["details"]["reason"] = (
                    f"{saturated_pct*100:.0f}% of readings at ADC max ({adc_max})"
                )
                results.append(diagnosis)
                continue

        # 7. Out of range check
        if expected:
            abs_min, abs_max = expected[0], expected[1]
            below = float(np.sum(values < abs_min))
            above = float(np.sum(values > abs_max))
            oor_pct = (below + above) / len(values)
            if oor_pct > 0.5:
                diagnosis["status"] = "out_of_range"
                diagnosis["details"]["reason"] = (
                    f"{oor_pct*100:.0f}% of readings outside [{abs_min}, {abs_max}]"
                )
                results.append(diagnosis)
                continue

        # 8. Erratic check: large jumps between consecutive readings
        if len(values) > 1:
            diffs = np.abs(np.diff(values))
            max_jump = float(np.max(diffs))
            mean_val = float(np.mean(np.abs(values)))
            diagnosis["details"]["max_jump"] = round(max_jump, 2)

            if mean_val > 0 and max_jump > ERRATIC_JUMP_FACTOR * mean_val:
                diagnosis["status"] = "erratic"
                diagnosis["details"]["reason"] = (
                    f"Max jump {max_jump:.1f} exceeds {ERRATIC_JUMP_FACTOR}× "
                    f"mean ({mean_val:.1f})"
                )
                results.append(diagnosis)
                continue

        # 9. All checks passed → healthy
        results.append(diagnosis)

    return results


