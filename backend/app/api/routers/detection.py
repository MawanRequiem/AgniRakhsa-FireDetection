"""
Detection API endpoints.

Handles image uploads from IoT devices for AI inference.
"""

from fastapi import APIRouter, File, UploadFile, Depends, Form, HTTPException
from typing import Optional
from uuid import UUID
from PIL import Image
import io

from app.schemas.detection import DetectionResponse, DetectionHistoryResponse, RiskAssessment
from app.services import detection_service, fusion_service
from app.ai import registry
from app.api.deps import CurrentUser

router = APIRouter(prefix="/detection", tags=["detection"])


@router.post("/image", response_model=DetectionResponse)
async def detect_image(
    file: UploadFile = File(...),
    device_id: Optional[UUID] = Form(None),
    room_id: Optional[UUID] = Form(None),
):
    """
    Upload an image for fire detection inference.
    
    This runs YOLOv8 on the image, stores the bounding boxes,
    and automatically triggers the late fusion engine if sensor data exists.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(400, f"Invalid image data: {e}")
    
    # 1. Run AI inference
    det_result = await detection_service.run_detection(
        image=image,
        device_id=device_id,
        room_id=room_id,
    )
    
    # 2. Trigger late fusion via Redis Stream
    import time
    from app.core.redis import redis_manager
    r_client = redis_manager.get_client()
    
    if r_client and room_id:
        r_client.xadd("fusion:events", {
            "type": "image",
            "room_id": str(room_id),
            "score": str(det_result["max_confidence"]),
            "timestamp": str(time.time()),
            "detection_event_id": str(det_result.get("id"))
        })
    else:
        # Fallback if Redis is offline
        await fusion_service.run_fusion(
            image_score=det_result["max_confidence"],
            room_id=room_id,
            detection_event_id=det_result.get("id"),
        )
    
    # 3. Build response
    # Since fusion is now async via streams, we cannot return the exact risk_assessment synchronously
    det_result["risk_assessment"] = None
    
    return det_result


@router.get("/history", response_model=DetectionHistoryResponse)
async def get_history(
    page: int = 1,
    page_size: int = 20,
    room_id: Optional[UUID] = None,
):
    """Get paginated history of past detection events."""
    return await detection_service.get_detection_history(
        page=page,
        page_size=page_size,
        room_id=room_id,
    )


@router.get("/model-info")
async def get_model_info():
    """Get metadata about the currently loaded AI model."""
    detector = registry.get_detector()
    return detector.get_model_info().model_dump()
