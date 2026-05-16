"""
Detection Service — Orchestrates AI inference + storage.

Handles the full pipeline: receive image → run YOLO → store result →
optionally capture detection image to Supabase Storage → trigger fusion.
"""

import io
import logging
import uuid
from typing import Optional
from uuid import UUID
from PIL import Image, ImageDraw, ImageFont

from app.ai import registry
from app.ai.schemas import DetectionResult
from app.core.db import supabase
from app.core.config import settings

logger = logging.getLogger(__name__)

# Minimum confidence to capture and upload image to storage
CAPTURE_THRESHOLD = 0.3


def _draw_detections_on_image(image: Image.Image, detections: list[dict]) -> Image.Image:
    """
    Draw bounding boxes and labels on a copy of the image for evidence capture.
    Returns a new annotated PIL Image (does not mutate original).
    """
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)

    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except (IOError, OSError):
        font = ImageFont.load_default()

    for det in detections:
        x1, y1, x2, y2 = det["x1"], det["y1"], det["x2"], det["y2"]
        conf = det["confidence"]
        cls_name = det.get("class_name", "fire")

        # Red bounding box
        draw.rectangle([x1, y1, x2, y2], outline="#FF2222", width=3)

        # Label background
        label = f"{cls_name} {conf:.0%}"
        bbox = draw.textbbox((x1, y1 - 20), label, font=font)
        draw.rectangle(bbox, fill="#FF2222")
        draw.text((x1, y1 - 20), label, fill="white", font=font)

    return annotated


def _upload_image_to_storage(image: Image.Image, room_id: Optional[UUID] = None) -> Optional[str]:
    """
    Upload an annotated detection image to Supabase Storage.

    Returns:
        Public URL of the uploaded image, or None on failure.
    """
    try:
        # Generate unique filename
        room_prefix = str(room_id)[:8] if room_id else "unknown"
        filename = f"{room_prefix}/{uuid.uuid4().hex[:12]}.jpg"

        # Convert PIL Image to JPEG bytes
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
        image_bytes = buffer.getvalue()

        # Upload to Supabase Storage
        supabase.storage.from_("detection-captures").upload(
            path=filename,
            file=image_bytes,
            file_options={"content-type": "image/jpeg"}
        )

        # Get public URL
        public_url = supabase.storage.from_("detection-captures").get_public_url(filename)

        logger.info(f"Detection image uploaded: {filename} ({len(image_bytes)} bytes)")
        return public_url

    except Exception as e:
        logger.error(f"Failed to upload detection image to storage: {e}")
        return None


async def run_detection(
    image: Image.Image,
    device_id: Optional[UUID] = None,
    room_id: Optional[UUID] = None,
) -> dict:
    """
    Run AI detection on an image and store the result.

    If fire is detected above CAPTURE_THRESHOLD, the frame is annotated
    with bounding boxes and uploaded to Supabase Storage as evidence.

    Args:
        image: PIL Image in RGB mode.
        device_id: Optional source device ID.
        room_id: Optional room assignment.

    Returns:
        Dict containing the detection event record with DB id and image_url.
    """
    import anyio
    detector = registry.get_detector()

    # Run inference in a background thread to prevent blocking the asyncio event loop
    result: DetectionResult = await anyio.to_thread.run_sync(detector.detect, image)

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

    # Capture and upload image if fire detected above threshold
    image_url = None
    if result.max_confidence >= CAPTURE_THRESHOLD and len(detections_json) > 0:
        annotated = await anyio.to_thread.run_sync(
            _draw_detections_on_image, image, detections_json
        )
        image_url = await anyio.to_thread.run_sync(
            _upload_image_to_storage, annotated, room_id
        )

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
    if image_url:
        insert_data["image_url"] = image_url

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
        "image_url": image_url,
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
