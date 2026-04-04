from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import base64
from io import BytesIO
from PIL import Image
import json
import asyncio
from typing import Dict
from uuid import UUID

from app.core.db import supabase
from app.services import detection_service, fusion_service
from app.api.ws_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/camera", tags=["camera_stream"])

# In-memory track of active camera connections
active_cameras: Dict[str, WebSocket] = {}

@router.websocket("/stream/{camera_id}")
async def camera_stream_endpoint(websocket: WebSocket, camera_id: str):
    """
    WebSocket endpoint for receiving live MJPEG frames from a camera source.
    Expects frames encoded as Base64 JSON: {"frame": "base64_jpeg_string"}
    Runs AI inference and broadcasts the result via the dashboard websocket.
    """
    logger.info(f"New camera stream connection attempt for camera: {camera_id}")
    
    # Verify camera exists
    res = supabase.table("cameras").select("*").eq("id", camera_id).execute()
    if not res.data:
        await websocket.close(code=4004, reason="Camera not found")
        logger.warning(f"Rejected stream: Camera {camera_id} not found")
        return
        
    camera_data = res.data[0]
    room_id = camera_data.get("room_id")
    if room_id:
        try:
            room_uuid = UUID(room_id)
        except ValueError:
            room_uuid = None
    else:
        room_uuid = None
        
    device_uuid = None # Cameras aren't full devices in our schema right now

    await websocket.accept()
    active_cameras[camera_id] = websocket
    
    # Mark camera as online
    supabase.table("cameras").update({"status": "online"}).eq("id", camera_id).execute()
    
    frame_count = 0
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                payload = json.loads(data)
                frame_b64 = payload.get("frame")
                if not frame_b64:
                    continue
                    
                # Decode Base64 to PIL Image
                image_bytes = base64.b64decode(frame_b64)
                image = Image.open(BytesIO(image_bytes)).convert("RGB")
                
                frame_count += 1
                
                # Run YOLO inference
                det_result = await detection_service.run_detection(
                    image=image, 
                    device_id=device_uuid, 
                    room_id=room_uuid
                )
                
                # Update camera status if detection
                has_detection = det_result.get("max_confidence", 0) > 0
                if has_detection:
                    supabase.table("cameras").update(
                        {"has_detection": True, "last_frame_at": "now()"}
                    ).eq("id", camera_id).execute()
                else:
                     supabase.table("cameras").update(
                        {"has_detection": False, "last_frame_at": "now()"}
                    ).eq("id", camera_id).execute()

                # Run Fusion
                fusion_res = await fusion_service.run_fusion(
                    image_score=det_result.get("max_confidence", 0.0),
                    room_id=room_uuid,
                    detection_event_id=det_result.get("id")
                )
                
                # Broadcast back to dashboard
                broadcast_payload = {
                     "type": "DETECTION_FRAME",
                     "data": {
                         "camera_id": camera_id,
                         "room_id": room_id,
                         "frame_b64": frame_b64,  # Send the frame back so dashboard can display it
                         "detections": det_result.get("detections", []),
                         "max_confidence": det_result.get("max_confidence", 0),
                         "image_width": det_result.get("image_width", 640),
                         "image_height": det_result.get("image_height", 480),
                         "fusion_score": fusion_res.get("fusion_score", 0),
                         "risk_level": fusion_res.get("risk_level", "safe")
                     }
                }
                await manager.broadcast(broadcast_payload)
                
                # Send simple ack back to the camera script so it knows frame was processed
                await websocket.send_json({"status": "ok", "detections": len(det_result.get("detections", []))})

            except Exception as e:
                logger.error(f"Error processing frame from camera {camera_id}: {e}")
                await websocket.send_json({"error": str(e)})
                
    except WebSocketDisconnect:
        logger.info(f"Camera {camera_id} disconnected")
        if camera_id in active_cameras:
            del active_cameras[camera_id]
        
        # Mark camera offline
        supabase.table("cameras").update(
            {"status": "offline", "has_detection": False}
        ).eq("id", camera_id).execute()
        
    except Exception as e:
         logger.error(f"Unexpected error in camera stream {camera_id}: {e}")
         if camera_id in active_cameras:
            del active_cameras[camera_id]
