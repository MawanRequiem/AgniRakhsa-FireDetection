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
    Optimized for high concurrency using Postgres RPC and Redis metadata caching.
    """
    if not readings:
        return 0

    # 1. Prepare readings for RPC JSONB
    formatted_readings = []
    for r in readings:
        row = {
            "sensor_id": str(r["sensor_id"]),
            "value": float(r["value"]),
        }
        if r.get("reading_at"):
            row["reading_at"] = r["reading_at"]
        formatted_readings.append(row)

    # 2. Call the atomic Postgres RPC (replaces 12 sequential DB hits with 1)
    supabase.rpc("ingest_sensor_batch_rpc", {
        "p_device_id": str(device_id),
        "p_readings": formatted_readings
    }).execute()

    now_utc = datetime.now(timezone.utc).isoformat()

    # 3. Handle device state & room ID caching
    from app.core.redis import redis_manager
    r_client = redis_manager.get_client()
    
    room_id = None
    device_name = "Device"
    was_offline = False
    
    if r_client:
        # Try getting metadata from Redis cache
        room_id = r_client.get(f"device:{device_id}:room_id")
        device_name = r_client.get(f"device:{device_id}:name")
        cached_status = r_client.get(f"device:{device_id}:status")
        was_offline = cached_status != "online"
        
        # Cache miss: fetch from database and store in Redis
        if not room_id or not device_name:
            device_res = supabase.table("devices").select("room_id, name, status").eq("id", str(device_id)).execute()
            if device_res.data:
                dev_data = device_res.data[0]
                room_id = dev_data.get("room_id")
                device_name = dev_data.get("name", "Device")
                was_offline = dev_data.get("status") != "online"
                
                if room_id:
                    r_client.set(f"device:{device_id}:room_id", str(room_id))
                r_client.set(f"device:{device_id}:name", device_name)
        
        # Update current status
        r_client.set(f"device:{device_id}:status", "online")
        
        # Invalidate the room sensor snapshot cache
        if room_id:
            r_client.delete(f"room:{room_id}:sensor_snapshot")
    else:
        # Fallback: directly read Postgres if Redis is down
        device_res = supabase.table("devices").select("room_id, name, status").eq("id", str(device_id)).execute()
        if device_res.data:
            dev_data = device_res.data[0]
            room_id = dev_data.get("room_id")
            device_name = dev_data.get("name", "Device")
            was_offline = dev_data.get("status") != "online"

    # 4. Fetch sensor types to build sensor_type_map (cached in Redis)
    sensor_ids = [str(r["sensor_id"]) for r in readings]
    sensor_type_map = {}
    missing_sensor_ids = []
    
    if r_client:
        for s_id in sensor_ids:
            s_type = r_client.get(f"sensor:{s_id}:type")
            if s_type:
                sensor_type_map[s_id] = s_type
            else:
                missing_sensor_ids.append(s_id)
    else:
        missing_sensor_ids = sensor_ids

    if missing_sensor_ids:
        sensor_meta = supabase.table("sensors").select("id, sensor_type").in_("id", missing_sensor_ids).execute()
        for s in (sensor_meta.data or []):
            sensor_type_map[s["id"]] = s["sensor_type"]
            if r_client:
                r_client.set(f"sensor:{s['id']}:type", s["sensor_type"])

    # 5. Push telemetry update to throttled WebSocket manager
    from app.api.ws_manager import manager
    ws_readings = [
        {"sensor_type": sensor_type_map.get(str(r["sensor_id"]), "UNKNOWN"), "value": r["value"]}
        for r in readings
    ]
    if hasattr(manager, "push_telemetry_update"):
        await manager.push_telemetry_update(str(device_id), ws_readings, now_utc)
    else:
        await manager.broadcast({
            "type": "SENSOR_UPDATE",
            "data": {
                "device_id": str(device_id),
                "readings": ws_readings,
                "timestamp": now_utc
            }
        })

    # 6. Broadcast DEVICE_STATUS_CHANGE if device just came back online
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

    # 6.5 Auto-complete active/pending commands and update device status if we receive telemetry
    try:
        active_commands_res = (
            supabase.table("device_commands")
            .select("id, command, status")
            .eq("device_id", str(device_id))
            .in_("status", ["pending", "in_progress"])
            .execute()
        )
        if active_commands_res.data:
            for cmd in active_commands_res.data:
                cmd_id = cmd["id"]
                cmd_name = cmd["command"]
                logger.info(
                    f"Auto-completing stuck/active command '{cmd_name}' (ID: {cmd_id}) "
                    f"for device {device_id} due to new telemetry ingestion."
                )
                # 1. Update command status to completed
                supabase.table("device_commands").update({
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", cmd_id).execute()

                # 2. Update device status according to command type
                target_status = "online"
                if cmd_name == "REBURNIN":
                    target_status = "burn_in"
                else:
                    dev_res = supabase.table("devices").select("created_at").eq("id", str(device_id)).execute()
                    if dev_res.data:
                        created_at_str = dev_res.data[0]["created_at"].replace("Z", "+00:00")
                        created_at = datetime.fromisoformat(created_at_str)
                        if (datetime.now(timezone.utc) - created_at).total_seconds() < 86400:
                            target_status = "burn_in"

                supabase.table("devices").update({"status": target_status}).eq("id", str(device_id)).execute()
                
                # 3. Broadcast status update via WebSocket
                await manager.broadcast({
                    "type": "DEVICE_STATUS_CHANGE",
                    "data": {
                        "device_id": str(device_id),
                        "status": target_status,
                        "name": device_name,
                    }
                })
    except Exception as e:
        logger.error(f"Error auto-completing stuck device commands: {e}")

    # 7. Feed sensor anomaly detector buffer (for Isolation Forest ML model)
    try:
        from app.ai import registry
        sensor_detector = registry.get_sensor_detector()
        if room_id:
            snapshot = {
                sensor_type_map.get(str(r["sensor_id"]), ""): r["value"]
                for r in readings
            }
            snapshot = {k: v for k, v in snapshot.items() if k}
            sensor_detector.ingest(str(room_id), snapshot)
            
            # Publish sensor event to Fusion Stream
            import json, time
            if r_client:
                r_client.xadd("fusion:events", {
                    "type": "sensor",
                    "room_id": str(room_id),
                    "snapshot": json.dumps(snapshot),
                    "timestamp": str(time.time())
                })
    except Exception as e:
        logger.warning(f"Failed to feed sensor anomaly buffer or publish to fusion: {e}")

    return len(readings)


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


import json

async def get_room_sensor_snapshot(room_id: UUID) -> dict:
    """
    Get a snapshot of all current sensor values for a room.
    Used by the fusion engine to build sensor_snapshot JSONB.
    Optimized to read from Redis cache first.
    
    Returns:
        Dict mapping sensor_type -> {value, unit, sensor_id}
    """
    from app.core.redis import redis_manager
    r_client = redis_manager.get_client()
    
    if r_client:
        cached_snapshot = r_client.get(f"room:{room_id}:sensor_snapshot")
        if cached_snapshot:
            try:
                return json.loads(cached_snapshot)
            except Exception as e:
                logger.error(f"Failed to parse cached sensor snapshot: {e}")
                
    # Fallback to database
    sensors = await get_all_sensors(room_id=room_id)
    
    snapshot = {}
    for s in sensors:
        snapshot[s["sensor_type"]] = {
            "value": s.get("current_value"),
            "unit": s.get("unit"),
            "sensor_id": s["id"],
            "last_update": s.get("last_update"),
        }
    
    if r_client and snapshot:
        try:
            # Cache snapshot for 10 minutes (600s)
            r_client.set(f"room:{room_id}:sensor_snapshot", json.dumps(snapshot), ex=600)
        except Exception as e:
            logger.error(f"Failed to cache sensor snapshot in Redis: {e}")
            
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
      [{time: "2026-06-03T19:22:10Z", MQ2: 200, SHTC3_TEMP: 25}, ...]
    """
    # 1. Determine bucket size in seconds dynamically based on history window
    if minutes <= 60:
        bucket_seconds = 30       # 30-second buckets
    elif minutes <= 1440:
        bucket_seconds = 300      # 5-minute buckets
    elif minutes <= 10080:
        bucket_seconds = 3600     # 1-hour buckets
    else:
        bucket_seconds = 14400    # 4-hour buckets

    # 2. Try querying via RPC for database-side aggregation
    try:
        rpc_params = {
            "p_minutes": minutes,
            "p_bucket_seconds": bucket_seconds
        }
        if device_id:
            rpc_params["p_device_id"] = str(device_id)
        if room_id:
            rpc_params["p_room_id"] = str(room_id)

        rpc_res = supabase.rpc("get_sensor_history_bucketed_rpc", rpc_params).execute()
        if rpc_res.data:
            from collections import defaultdict
            time_buckets = defaultdict(dict)
            for r in rpc_res.data:
                b_time = r["bucket_time"]
                s_type = r["sensor_type"]
                val = r["avg_value"]
                
                time_buckets[b_time][s_type] = float(val) if val is not None else 0.0
                time_buckets[b_time]["_time"] = b_time

            result = sorted(time_buckets.values(), key=lambda x: x.get("_time", ""))
            for entry in result:
                entry["time"] = entry.pop("_time", "")
            return result
    except Exception as e:
        logger.warning(f"Failed to use get_sensor_history_bucketed_rpc, falling back: {e}")

    # 3. Fallback logic: Client-side downsampling/bucketing
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
    
    # Scale query limit dynamically (larger window = fetch more rows to span the interval)
    fetch_limit = 5000 if minutes <= 1440 else 10000

    # Fetch readings in the time window, ordered newest first so we get recent data if limit is hit
    readings_res = (
        supabase.table("sensor_readings")
        .select("sensor_id, value, reading_at")
        .in_("sensor_id", sensor_ids)
        .gte("reading_at", since.isoformat())
        .order("reading_at", desc=True)
        .limit(fetch_limit)
        .execute()
    )
    
    readings = readings_res.data or []
    
    # Group by dynamically sized timestamp bucket (nearest N seconds for smoothing)
    from collections import defaultdict
    time_buckets = defaultdict(dict)
    
    for r in readings:
        raw_time = r["reading_at"]
        try:
            dt = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            continue
        
        # Round epoch timestamp down to the nearest bucket_seconds interval
        epoch = int(dt.timestamp())
        rounded_epoch = (epoch // bucket_seconds) * bucket_seconds
        bucket_dt = datetime.fromtimestamp(rounded_epoch, tz=timezone.utc)
        bucket_key = bucket_dt.isoformat()
        
        sensor_type = sensor_type_map.get(r["sensor_id"], "UNKNOWN")
        
        # In case of duplicates in the same bucket, average them (or take newest)
        if sensor_type not in time_buckets[bucket_key]:
            time_buckets[bucket_key][sensor_type] = []
        time_buckets[bucket_key][sensor_type].append(r["value"])
        time_buckets[bucket_key]["_time"] = bucket_key
    
    # Calculate average value per bucket
    pivoted_result = []
    for bucket_key, readings_dict in time_buckets.items():
        entry = {"_time": bucket_key}
        for k, v in readings_dict.items():
            if k == "_time":
                continue
            entry[k] = round(sum(v) / len(v), 2)
        pivoted_result.append(entry)

    # Convert to sorted list (chronological)
    result = sorted(pivoted_result, key=lambda x: x.get("_time", ""))
    
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

        # 5. Stuck check: near-zero standard deviation (bypassed for digital SHTC3 sensors)
        is_digital_sht = "SHTC3" in stype.upper()
        if not is_digital_sht and np.std(values) < STUCK_STD_THRESHOLD:
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


async def export_sensor_readings_to_csv(
    room_id: Optional[UUID] = None,
    device_id: Optional[UUID] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> str:
    """
    Query historical sensor readings for a room or specific device,
    align them into 1-minute time buckets, pivot the metrics, and
    return a cleanly formatted tabular CSV string.
    """
    # 1. Resolve active sensors
    sensor_query = supabase.table("sensors").select("id, sensor_type, device_id")
    if device_id:
        sensor_query = sensor_query.eq("device_id", str(device_id))
    elif room_id:
        sensor_query = sensor_query.eq("room_id", str(room_id))
    
    sensor_res = sensor_query.execute()
    sensors = sensor_res.data or []
    if not sensors:
        return "Timestamp,Device Name,Device MAC,Sensor Type,Value\n# No sensors found for target scope"

    sensor_ids = [s["id"] for s in sensors]

    # 2. Query device names and MAC addresses
    device_ids = list(set(s["device_id"] for s in sensors if s.get("device_id")))
    if device_ids:
        device_res = supabase.table("devices").select("id, name, mac_address").in_("id", device_ids).execute()
        device_map = {d["id"]: d for d in (device_res.data or [])}
    else:
        device_map = {}

    # 3. Fetch readings in the specified range
    readings_query = supabase.table("sensor_readings").select("sensor_id, value, reading_at").in_("sensor_id", sensor_ids)
    if start_time:
        readings_query = readings_query.gte("reading_at", start_time.isoformat())
    if end_time:
        readings_query = readings_query.lte("reading_at", end_time.isoformat())
    
    readings_res = readings_query.order("reading_at", desc=False).limit(20000).execute()
    readings = readings_res.data or []
    if not readings:
        return "Timestamp,Device Name,Device MAC\n# No historical records found in this time range"

    # 4. Process with Pandas
    import pandas as pd
    
    sensor_rows = []
    for s in sensors:
        d = device_map.get(s["device_id"], {})
        sensor_rows.append({
            "sensor_id": s["id"],
            "sensor_type": s["sensor_type"],
            "device_name": d.get("name", "Unknown Node"),
            "device_mac": d.get("mac_address", "—")
        })
    df_sensors = pd.DataFrame(sensor_rows)
    df_readings = pd.DataFrame(readings)
    
    df_merged = pd.merge(df_readings, df_sensors, on="sensor_id")
    if df_merged.empty:
        return "Timestamp,Device Name,Device MAC\n# No combined logs match sensor configuration"

    df_merged["reading_at_dt"] = pd.to_datetime(df_merged["reading_at"])
    df_merged["Timestamp"] = df_merged["reading_at_dt"].dt.floor("1min").dt.strftime("%Y-%m-%d %H:%M:%S")

    df_pivoted = df_merged.pivot_table(
        index=["Timestamp", "device_name", "device_mac"],
        columns="sensor_type",
        values="value",
        aggfunc="mean"
    ).reset_index()

    df_pivoted = df_pivoted.sort_values(by=["Timestamp", "device_name"])
    
    return df_pivoted.to_csv(index=False)



