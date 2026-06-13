"""
Late Fusion Worker — Temporal matching of image + sensor events from Redis Stream.

Architecture:
  Redis Stream (fusion:events) ──→ Worker buffers ──→ Temporal Match ──→ Fusion Service

The worker supports THREE fusion paths:
  1. Image + Sensor match (full late fusion, weighted score)
  2. Image-only fallback (after match window expires, sensor_snapshot from DB)
  3. Sensor-only evaluation (independent sensor anomaly path, no camera needed)

Path 3 is critical: high gas/flame/temperature readings MUST trigger alerts
even if the camera is offline, obstructed, or not pointed at the fire source.
"""

import asyncio
import logging
import json
import time
from typing import Dict, List, Optional
from collections import defaultdict
from datetime import datetime, timezone

from app.core.redis import redis_manager
from app.core.config import settings
from app.services import fusion_service
from app.core.db import supabase

logger = logging.getLogger(__name__)

# Buffer structure: {room_id: {"image": [event1, ...], "sensor": [event1, ...]}}
buffers: Dict[str, Dict[str, List[dict]]] = defaultdict(lambda: {"image": [], "sensor": []})

MAX_AGE_SECONDS = 5.0
MATCH_WINDOW_SECONDS = 2.0

# Sustained sensor reading buffer for Path 3 (sensor-only)
# Key: room_id, Value: list of recent sensor scores (rolling window)
# Alert only fires when ALL values in the window exceed the threshold
_sensor_score_buffer: Dict[str, list[float]] = defaultdict(list)

# Camera detection voting buffer for temporal consistency (NFPA 72 inspired)
# Key: room_id, Value: list of recent image scores (rolling window)
# Alert only fires when N out of M consecutive frames detect fire
_image_vote_buffer: Dict[str, list[float]] = defaultdict(list)


async def process_buffers():
    """
    Evaluate buffers for matches and clean up old events.
    
    Implements three fusion paths:
    1. Image + Sensor match → full weighted late fusion
    2. Image-only expired → fusion with DB sensor snapshot
    3. Sensor-only high risk → fusion with image_score=0 (sensor-driven alert)
    """
    now = time.time()
    
    for room_id, room_buffer in list(buffers.items()):
        images = room_buffer["image"]
        sensors = room_buffer["sensor"]
        
        # Cleanup old events
        room_buffer["image"] = [e for e in images if now - e["timestamp"] <= MAX_AGE_SECONDS]
        room_buffer["sensor"] = [e for e in sensors if now - e["timestamp"] <= MAX_AGE_SECONDS]
        
        images = room_buffer["image"]
        sensors = room_buffer["sensor"]
        
        # ─── Path 1 & 2: Image-driven fusion ─────────────────────────────
        if images:
            img_event = images[0]
            
            best_sensor = None
            best_diff = float('inf')
            
            for sens_event in sensors:
                diff = abs(img_event["timestamp"] - sens_event["timestamp"])
                if diff <= MATCH_WINDOW_SECONDS and diff < best_diff:
                    best_sensor = sens_event
                    best_diff = diff
                    
            if best_sensor:
                # Path 1: Image + Sensor match!
                logger.info(f"Fusion Match! Room {room_id}, diff: {best_diff:.3f}s")
                
                room_buffer["image"].remove(img_event)
                room_buffer["sensor"].remove(best_sensor)

                # ─── Temporal Frame Voting ─────────────────────────────
                # Don't trigger fusion on every frame. Buffer scores and
                # only fire when N out of M frames confirm a detection.
                img_score = img_event["score"]
                conf_floor = settings.IMAGE_CONFIDENCE_FLOOR
                
                if img_score >= conf_floor:
                    _image_vote_buffer[room_id].append(img_score)
                else:
                    _image_vote_buffer[room_id].append(0.0)
                
                # Keep only last M frames
                window = settings.IMAGE_VOTE_WINDOW
                _image_vote_buffer[room_id] = _image_vote_buffer[room_id][-window:]
                
                # Count votes
                votes = sum(1 for s in _image_vote_buffer[room_id] if s >= conf_floor)
                required = settings.IMAGE_VOTE_REQUIRED
                
                if votes >= required:
                    # Confirmed detection — use average confident score
                    confident_scores = [s for s in _image_vote_buffer[room_id] if s >= conf_floor]
                    avg_score = sum(confident_scores) / len(confident_scores)
                    _image_vote_buffer[room_id] = []  # Reset after triggering
                    
                    logger.info(
                        f"Camera vote confirmed for room {room_id}: "
                        f"{votes}/{required} votes, avg_score={avg_score:.3f}"
                    )
                    
                    try:
                        await fusion_service.run_fusion(
                            image_score=avg_score,
                            room_id=img_event.get("room_id"),
                            detection_event_id=img_event.get("detection_event_id"),
                            sensor_snapshot=best_sensor.get("snapshot"),
                            image_url=img_event.get("image_url"),
                        )
                    except Exception as e:
                        logger.error(f"Error running fusion (path 1): {e}")
                else:
                    logger.debug(
                        f"Camera vote buffer for room {room_id}: "
                        f"{votes}/{required} (building...)"
                    )
            else:
                # Path 2: Image expired without sensor match
                if now - img_event["timestamp"] > MATCH_WINDOW_SECONDS:
                    room_buffer["image"].remove(img_event)

                    # Apply same voting logic for path 2
                    img_score = img_event["score"]
                    conf_floor = settings.IMAGE_CONFIDENCE_FLOOR
                    
                    if img_score >= conf_floor:
                        _image_vote_buffer[room_id].append(img_score)
                    else:
                        _image_vote_buffer[room_id].append(0.0)
                    
                    window = settings.IMAGE_VOTE_WINDOW
                    _image_vote_buffer[room_id] = _image_vote_buffer[room_id][-window:]
                    
                    votes = sum(1 for s in _image_vote_buffer[room_id] if s >= conf_floor)
                    required = settings.IMAGE_VOTE_REQUIRED
                    
                    if votes >= required:
                        confident_scores = [s for s in _image_vote_buffer[room_id] if s >= conf_floor]
                        avg_score = sum(confident_scores) / len(confident_scores)
                        _image_vote_buffer[room_id] = []
                        
                        logger.info(
                            f"Camera vote confirmed (path 2) for room {room_id}: "
                            f"{votes}/{required} votes, avg_score={avg_score:.3f}"
                        )
                        
                        try:
                            await fusion_service.run_fusion(
                                image_score=avg_score,
                                room_id=img_event.get("room_id"),
                                detection_event_id=img_event.get("detection_event_id"),
                                sensor_snapshot=None,
                                image_url=img_event.get("image_url"),
                            )
                        except Exception as e:
                            logger.error(f"Error running fusion (path 2): {e}")
                    else:
                        logger.debug(
                            f"Camera vote buffer (path 2) for room {room_id}: "
                            f"{votes}/{required} (building...)"
                        )
        
        # ─── Path 3: Sensor-only evaluation ──────────────────────────────
        # Process sensor events that have NO matching image event.
        # Uses sustained readings: requires N consecutive windows above threshold
        # before triggering. Prevents false positives from transient sensor spikes.
        if sensors and not images:
            sens_event = sensors[0]

            if now - sens_event["timestamp"] > MATCH_WINDOW_SECONDS:
                room_buffer["sensor"].remove(sens_event)

                snapshot = sens_event.get("snapshot", {})
                sensor_score = _evaluate_sensor_risk(snapshot, room_id)

                required_windows = settings.SENSOR_ONLY_CONSECUTIVE_WINDOWS
                threshold = settings.SENSOR_ONLY_THRESHOLD

                if sensor_score >= threshold:
                    _sensor_score_buffer[room_id].append(sensor_score)
                    if len(_sensor_score_buffer[room_id]) > required_windows:
                        _sensor_score_buffer[room_id] = _sensor_score_buffer[room_id][-required_windows:]
                else:
                    _sensor_score_buffer[room_id] = []

                buf_len = len(_sensor_score_buffer[room_id])
                if buf_len >= required_windows:
                    avg_score = sum(_sensor_score_buffer[room_id]) / buf_len
                    logger.warning(
                        f"🔥 SENSOR-ONLY ALERT for room {room_id}! "
                        f"sustained sensor_score avg={avg_score:.3f} "
                        f"({buf_len}/{required_windows} consecutive windows). "
                        f"Snapshot: {snapshot}"
                    )
                    _sensor_score_buffer[room_id] = []

                    try:
                        # Try to grab latest camera frame as visual evidence
                        image_url = _get_latest_camera_frame(room_id)

                        await fusion_service.run_fusion(
                            image_score=0.0,
                            room_id=room_id,
                            detection_event_id=None,
                            sensor_snapshot=snapshot,
                            image_url=image_url,
                        )
                    except Exception as e:
                        logger.error(f"Error running sensor-only fusion (path 3): {e}")
                else:
                    logger.debug(
                        f"Sensor event for room {room_id} above threshold but "
                        f"building sustained window ({buf_len}/{required_windows}): "
                        f"score={sensor_score:.3f}"
                    )

                    # Also reset room to safe if readings are consistently low
                    try:
                        room_res = supabase.table("rooms").select("status").eq("id", str(room_id)).execute()
                        if room_res.data:
                            current_status = room_res.data[0].get("status")
                            if current_status != "safe":
                                active_res = (
                                    supabase.table("alerts")
                                    .select("id")
                                    .eq("room_id", str(room_id))
                                    .eq("is_acknowledged", False)
                                    .execute()
                                )
                                if not active_res.data:
                                    logger.info(f"Resetting room {room_id} status to safe")
                                    supabase.table("rooms").update({"status": "safe"}).eq("id", str(room_id)).execute()
                    except Exception as e:
                        logger.error(f"Error resetting room {room_id} status to safe: {e}")


def _evaluate_sensor_risk(snapshot: dict, room_id: str) -> float:
    """
    Evaluate sensor risk score using the shared dual-path strategy from fusion_service.
    Includes IF sanity gate to prevent ML hallucinations.
    
    Returns:
        Float 0.0 (safe) to 1.0 (critical).
    """
    score, algorithm = fusion_service.score_sensors(room_id, snapshot)
    logger.debug(f"Sensor-only eval for room {room_id}: score={score:.4f}, algorithm={algorithm}")
    return score


def _get_latest_camera_frame(room_id: str) -> Optional[str]:
    """
    Grab the most recent image_url from detection_events for this room.
    Only returns frames captured within the last 30 seconds — stale frames
    are useless as evidence.
    
    Returns:
        image_url string or None.
    """
    try:
        result = (
            supabase.table("detection_events")
            .select("image_url, created_at")
            .eq("room_id", str(room_id))
            .not_.is_("image_url", "null")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            det = result.data[0]
            det_time_str = det.get("created_at")
            image_url = det.get("image_url")
            if det_time_str and image_url:
                det_time = datetime.fromisoformat(det_time_str.replace("Z", "+00:00"))
                age = (datetime.now(timezone.utc) - det_time).total_seconds()
                if age < 30:
                    logger.info(
                        f"Grabbed camera frame for room {room_id}: "
                        f"age={age:.1f}s, url={image_url[:60]}..."
                    )
                    return image_url
                else:
                    logger.debug(
                        f"Latest camera frame for room {room_id} is too old: "
                        f"{age:.1f}s > 30s"
                    )
    except Exception as e:
        logger.warning(
            f"Could not fetch latest detection image for room {room_id}: {e}"
        )
    return None


async def run_fusion_worker():
    """Background worker to read from fusion Redis stream and process events."""
    logger.info("Starting Fusion Worker (with sensor-only alert path)...")
    
    # Wait for Redis to connect
    await asyncio.sleep(2)
    
    async_client = redis_manager.get_async_client()
    if not async_client:
        logger.warning("No async Redis client available. Fusion Worker will not run. (Check USE_REDIS in config)")
        return
        
    last_id = "0"
    STREAM_KEY = "fusion:events"
    
    while True:
        try:
            # Block for 1 second, then process buffers
            response = await async_client.xread({STREAM_KEY: last_id}, count=100, block=1000)
            
            if response:
                for stream_name, messages in response:
                    for message_id, message_data in messages:
                        last_id = message_id
                        
                        room_id = message_data.get("room_id")
                        if not room_id:
                            continue
                            
                        event_type = message_data.get("type")
                        ts = float(message_data.get("timestamp", time.time()))
                        
                        if event_type == "image":
                            buffers[room_id]["image"].append({
                                "score": float(message_data.get("score", 0.0)),
                                "timestamp": ts,
                                "room_id": room_id,
                                "detection_event_id": message_data.get("detection_event_id"),
                                "image_url": message_data.get("image_url"),
                            })
                        elif event_type == "sensor":
                            # snapshot is serialized JSON
                            snapshot_str = message_data.get("snapshot", "{}")
                            try:
                                snapshot = json.loads(snapshot_str)
                            except (json.JSONDecodeError, TypeError) as e:
                                logger.debug(f"Failed to parse sensor snapshot JSON: {e}")
                                snapshot = {}
                                
                            buffers[room_id]["sensor"].append({
                                "snapshot": snapshot,
                                "timestamp": ts,
                                "room_id": room_id
                            })
            
            # Process buffers every loop iteration (at least every 1 second)
            await process_buffers()
            
        except asyncio.CancelledError:
            logger.info("Fusion Worker shutting down.")
            break
        except Exception as e:
            logger.error(f"Fusion Worker error: {e}")
            await asyncio.sleep(1)
