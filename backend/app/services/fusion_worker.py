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
from typing import Dict, List
from collections import defaultdict

from app.core.redis import redis_manager
from app.services import fusion_service

logger = logging.getLogger(__name__)

# Buffer structure: {room_id: {"image": [event1, ...], "sensor": [event1, ...]}}
buffers: Dict[str, Dict[str, List[dict]]] = defaultdict(lambda: {"image": [], "sensor": []})

MAX_AGE_SECONDS = 5.0
MATCH_WINDOW_SECONDS = 2.0

# Sensor-only alert: minimum threshold score to trigger fusion without camera
# This allows high gas readings to bypass the image requirement
SENSOR_ONLY_THRESHOLD = 0.5

# Track last sensor-only alert per room to prevent spam
_sensor_only_cooldowns: Dict[str, float] = {}
SENSOR_ONLY_COOLDOWN_SECONDS = 30


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
                
                try:
                    await fusion_service.run_fusion(
                        image_score=img_event["score"],
                        room_id=img_event.get("room_id"),
                        detection_event_id=img_event.get("detection_event_id"),
                        sensor_snapshot=best_sensor.get("snapshot"),
                        image_url=img_event.get("image_url"),
                    )
                except Exception as e:
                    logger.error(f"Error running fusion (path 1): {e}")
            else:
                # Path 2: Image expired without sensor match
                if now - img_event["timestamp"] > MATCH_WINDOW_SECONDS:
                    logger.info(f"Image event for room {room_id} expired without sensor match. Fusing anyway.")
                    room_buffer["image"].remove(img_event)
                    try:
                        await fusion_service.run_fusion(
                            image_score=img_event["score"],
                            room_id=img_event.get("room_id"),
                            detection_event_id=img_event.get("detection_event_id"),
                            sensor_snapshot=None,
                            image_url=img_event.get("image_url"),
                        )
                    except Exception as e:
                        logger.error(f"Error running fusion (path 2): {e}")
        
        # ─── Path 3: Sensor-only evaluation ──────────────────────────────
        # Process sensor events that have NO matching image event.
        # This is the critical path for aerosol/gas/flame sensor-only detection.
        if sensors and not images:
            # Take the oldest unmatched sensor event
            sens_event = sensors[0]
            
            # Only process if it's old enough that we know no image is coming
            if now - sens_event["timestamp"] > MATCH_WINDOW_SECONDS:
                room_buffer["sensor"].remove(sens_event)
                
                # Check cooldown to prevent alert spam
                last_alert = _sensor_only_cooldowns.get(room_id, 0)
                if now - last_alert < SENSOR_ONLY_COOLDOWN_SECONDS:
                    continue
                
                # Evaluate sensor risk using threshold/IF scoring
                snapshot = sens_event.get("snapshot", {})
                sensor_score = _evaluate_sensor_risk(snapshot, room_id)
                
                if sensor_score >= SENSOR_ONLY_THRESHOLD:
                    logger.warning(
                        f"🔥 SENSOR-ONLY ALERT for room {room_id}! "
                        f"sensor_score={sensor_score:.3f} (threshold={SENSOR_ONLY_THRESHOLD}). "
                        f"Snapshot: {snapshot}"
                    )
                    _sensor_only_cooldowns[room_id] = now
                    
                    try:
                        # Run fusion with image_score=0 (sensor-driven)
                        await fusion_service.run_fusion(
                            image_score=0.0,
                            room_id=room_id,
                            detection_event_id=None,
                            sensor_snapshot=snapshot,
                            image_url=None,
                        )
                    except Exception as e:
                        logger.error(f"Error running sensor-only fusion (path 3): {e}")
                else:
                    logger.debug(
                        f"Sensor event for room {room_id} below threshold: "
                        f"score={sensor_score:.3f} < {SENSOR_ONLY_THRESHOLD}"
                    )


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
