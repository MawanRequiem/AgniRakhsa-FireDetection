"""
Detection Service — Orchestrates AI inference + storage.

Handles the full pipeline: receive image → run YOLO → store result → trigger fusion.
"""

import logging
from typing import Optional
from uuid import UUID
from PIL import Image

from app.ai import registry
from app.ai.schemas import DetectionResult
from app.core.db import supabase

logger = logging.getLogger(__name__)


async def run_detection(
    image: Image.Image,
    device_id: Optional[UUID] = None,
    room_id: Optional[UUID] = None,
) -> dict:
    """
    Run AI detection on an image and store the result.
    
    Args:
        image: PIL Image in RGB mode.
        device_id: Optional source device ID.
        room_id: Optional room assignment.
        
    Returns:
        Dict containing the detection event record with DB id.
    """
    detector = registry.get_detector()
    
    # Run inference
    result: DetectionResult = detector.detect(image)
    
    logger.info(
        f"Detection complete: {len(result.detections)} objects found, "
        f"max_confidence={result.max_confidence:.3f}, "
        f"time={result.processing_time_ms}ms"
    )
    
    # Serialize detections for JSONB storage
    detections_json = [
        {
            "x1": d.x1, "y1": d.y1,
            "x2": d.x2, "y2": d.y2,
            "confidence": d.confidence,
            "class_name": d.class_name,
            "class_id": d.class_id,
        }
        for d in result.detections
    ]
    
    # Store to database
    insert_data = {
        "model_name": result.model_name,
        "model_version": result.model_version,
        "detections": detections_json,
        "max_confidence": result.max_confidence,
        "detection_class": result.detection_class,
        "processing_time_ms": result.processing_time_ms,
    }
    
    if device_id:
        insert_data["device_id"] = str(device_id)
    if room_id:
        insert_data["room_id"] = str(room_id)
    
    db_result = (
        supabase.table("detection_events")
        .insert(insert_data)
        .execute()
    )
    
    event_record = db_result.data[0] if db_result.data else {}
    
    return {
        "id": event_record.get("id"),
        "detections": detections_json,
        "max_confidence": result.max_confidence,
        "detection_class": result.detection_class,
        "model_name": result.model_name,
        "model_version": result.model_version,
        "processing_time_ms": result.processing_time_ms,
        "image_width": result.image_width,
        "image_height": result.image_height,
        "created_at": event_record.get("created_at"),
    }


async def get_detection_history(
    page: int = 1,
    page_size: int = 20,
    room_id: Optional[UUID] = None,
) -> dict:
    """
    Fetch paginated detection event history.
    
    Args:
        page: Page number (1-indexed).
        page_size: Items per page.
        room_id: Optional filter by room.
        
    Returns:
        Dict with items list, total count, page, page_size.
    """
    offset = (page - 1) * page_size
    
    query = supabase.table("detection_events").select("*", count="exact")
    
    if room_id:
        query = query.eq("room_id", str(room_id))
    
    result = (
        query
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    
    return {
        "items": result.data or [],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }
