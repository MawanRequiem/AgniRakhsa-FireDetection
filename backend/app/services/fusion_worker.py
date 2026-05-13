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

async def process_buffers():
    """Evaluate buffers for matches and clean up old events."""
    now = time.time()
    
    for room_id, room_buffer in list(buffers.items()):
        images = room_buffer["image"]
        sensors = room_buffer["sensor"]
        
        # Cleanup old events
        room_buffer["image"] = [e for e in images if now - e["timestamp"] <= MAX_AGE_SECONDS]
        room_buffer["sensor"] = [e for e in sensors if now - e["timestamp"] <= MAX_AGE_SECONDS]
        
        images = room_buffer["image"]
        sensors = room_buffer["sensor"]
        
        if not images:
            continue
            
        # Try to find a match
        # We take the oldest image event and try to find a sensor event within MATCH_WINDOW
        img_event = images[0]
        
        best_sensor = None
        best_diff = float('inf')
        
        for sens_event in sensors:
            diff = abs(img_event["timestamp"] - sens_event["timestamp"])
            if diff <= MATCH_WINDOW_SECONDS and diff < best_diff:
                best_sensor = sens_event
                best_diff = diff
                
        if best_sensor:
            # Match found!
            logger.info(f"Fusion Match! Room {room_id}, diff: {best_diff:.3f}s")
            
            # Remove them from buffers
            room_buffer["image"].remove(img_event)
            room_buffer["sensor"].remove(best_sensor)
            
            # Run fusion
            try:
                await fusion_service.run_fusion(
                    image_score=img_event["score"],
                    room_id=img_event.get("room_id"),
                    detection_event_id=img_event.get("detection_event_id"),
                    sensor_snapshot=best_sensor.get("snapshot")
                )
            except Exception as e:
                logger.error(f"Error running fusion: {e}")
        else:
            # If the image event is getting old (> MATCH_WINDOW_SECONDS), we might want to 
            # run fusion with an empty sensor snapshot to not lose the image alert.
            if now - img_event["timestamp"] > MATCH_WINDOW_SECONDS:
                logger.info(f"Image event for room {room_id} expired without sensor match. Fusing anyway.")
                room_buffer["image"].remove(img_event)
                try:
                    await fusion_service.run_fusion(
                        image_score=img_event["score"],
                        room_id=img_event.get("room_id"),
                        detection_event_id=img_event.get("detection_event_id"),
                        sensor_snapshot=None  # will fallback to latest in DB or threshold
                    )
                except Exception as e:
                    logger.error(f"Error running fusion fallback: {e}")

async def run_fusion_worker():
    """Background worker to read from fusion Redis stream and process events."""
    logger.info("Starting Fusion Worker...")
    
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
                                "detection_event_id": message_data.get("detection_event_id")
                            })
                        elif event_type == "sensor":
                            # snapshot is serialized JSON
                            snapshot_str = message_data.get("snapshot", "{}")
                            try:
                                snapshot = json.loads(snapshot_str)
                            except:
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
