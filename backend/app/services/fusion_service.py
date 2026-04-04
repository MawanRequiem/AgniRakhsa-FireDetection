"""
Late Fusion Service — Combines image + sensor ML model outputs.

Architecture:
  Image Model (YOLO) ──→ image_score ──┐
                                        ├──→ fusion_score ──→ risk_level ──→ alert?
  Sensor Model (future RF/XGBoost) ──→ ─┘
  
Currently, the sensor side uses a rule-based fallback (threshold checks on
raw gas/flame/temp readings) until a dedicated sensor ML model is trained.
The sensor model will follow the same BaseDetector pattern for hot-swappability.

Fusion formula:
  fusion_score = (FUSION_WEIGHT_IMAGE * image_score) + (FUSION_WEIGHT_SENSOR * sensor_score)
"""

import logging
import asyncio
from typing import Optional
from uuid import UUID

from app.core.config import settings
from app.core.db import supabase
from app.services import sensor_service
from app.api.ws_manager import manager

logger = logging.getLogger(__name__)

# ─── Sensor Threshold Fallback ────────────────────────────────────────────────
# These thresholds are used until a proper sensor ML model is integrated.
# They convert raw sensor values into a normalized risk score (0-1).

SENSOR_THRESHOLDS = {
    # sensor_type: (safe_max, warning_threshold, danger_threshold, unit)
    "mq2":          (300,   500,    800,   "ppm"),    # Smoke/combustible gas
    "mq4":          (200,   400,    700,   "ppm"),    # Methane/CNG
    "mq6":          (200,   400,    700,   "ppm"),    # LPG/Butane
    "mq9b":         (50,    100,    200,   "ppm"),    # CO (more dangerous at lower ppm)
    "flame":        (3000,  2000,   1000,  "raw"),    # Flame IR (lower = more fire)
    "shtc3_temp":   (40,    55,     70,    "°C"),     # Temperature
    "shtc3_humidity":(80,   60,     40,    "%RH"),    # Humidity (lower = drier = more risk)
}


def _compute_sensor_score_from_thresholds(snapshot: dict) -> float:
    """
    Rule-based sensor risk scoring (fallback until sensor ML model is ready).
    
    For each sensor with a valid reading, compute a normalized risk score
    and return the maximum across all sensors.
    
    Returns:
        Float between 0.0 (safe) and 1.0 (critical).
    """
    if not snapshot:
        return 0.0
    
    risk_scores = []
    
    for sensor_type, data in snapshot.items():
        value = data.get("value")
        if value is None:
            continue
        
        thresholds = SENSOR_THRESHOLDS.get(sensor_type)
        if thresholds is None:
            continue
        
        safe_max, warning, danger = thresholds[0], thresholds[1], thresholds[2]
        
        # Special handling: flame sensor is inverted (lower value = more fire)
        if sensor_type == "flame":
            if value <= danger:
                score = 1.0
            elif value <= warning:
                score = 0.5 + 0.5 * (warning - value) / (warning - danger)
            elif value <= safe_max:
                score = 0.2 * (safe_max - value) / (safe_max - warning)
            else:
                score = 0.0
        # Humidity: lower = drier = more fire risk
        elif sensor_type == "shtc3_humidity":
            if value <= danger:
                score = 1.0
            elif value <= warning:
                score = 0.5 + 0.5 * (warning - value) / (warning - danger)
            elif value <= safe_max:
                score = 0.2 * (safe_max - value) / (safe_max - warning)
            else:
                score = 0.0
        # Standard sensors: higher value = more risk
        else:
            if value >= danger:
                score = 1.0
            elif value >= warning:
                score = 0.5 + 0.5 * (value - warning) / (danger - warning)
            elif value >= safe_max:
                score = 0.2 * (value - safe_max) / (warning - safe_max)
            else:
                score = 0.0
        
        risk_scores.append(min(max(score, 0.0), 1.0))
    
    return max(risk_scores) if risk_scores else 0.0


def _score_to_risk_level(fusion_score: float) -> str:
    """Map a fusion score (0-1) to a human-readable risk level."""
    if fusion_score >= settings.RISK_THRESHOLD_CRITICAL:
        return "critical"
    elif fusion_score >= settings.RISK_THRESHOLD_HIGH:
        return "high"
    elif fusion_score >= settings.RISK_THRESHOLD_MEDIUM:
        return "medium"
    elif fusion_score >= settings.RISK_THRESHOLD_LOW:
        return "low"
    return "safe"


async def run_fusion(
    image_score: float,
    room_id: Optional[UUID] = None,
    detection_event_id: Optional[UUID] = None,
    sensor_snapshot: Optional[dict] = None,
) -> dict:
    """
    Run late fusion combining image and sensor scores.
    
    Args:
        image_score: Confidence from the image model (0-1).
        room_id: Room to pull sensor data from (if snapshot not provided).
        detection_event_id: FK to the detection_events record.
        sensor_snapshot: Pre-built sensor data dict. If None, fetched from DB.
        
    Returns:
        Dict with fusion_score, risk_level, and the stored fusion_result ID.
    """
    # Get sensor snapshot if not provided
    if sensor_snapshot is None and room_id:
        sensor_snapshot = await sensor_service.get_room_sensor_snapshot(room_id)
    
    if sensor_snapshot is None:
        sensor_snapshot = {}
    
    # Compute sensor score (rule-based fallback for now)
    # TODO: Replace with sensor ML model when trained
    sensor_score = _compute_sensor_score_from_thresholds(sensor_snapshot)
    
    # Weighted late fusion
    fusion_score = (
        settings.FUSION_WEIGHT_IMAGE * image_score
        + settings.FUSION_WEIGHT_SENSOR * sensor_score
    )
    fusion_score = min(max(fusion_score, 0.0), 1.0)
    
    risk_level = _score_to_risk_level(fusion_score)
    
    logger.info(
        f"Fusion result: image={image_score:.3f} sensor={sensor_score:.3f} "
        f"fusion={fusion_score:.3f} risk={risk_level}"
    )
    
    # Store fusion result
    insert_data = {
        "image_score": image_score,
        "sensor_score": sensor_score,
        "fusion_score": fusion_score,
        "risk_level": risk_level,
        "sensor_snapshot": sensor_snapshot,
        "algorithm_version": "v1.0-threshold-fallback",
    }
    
    if room_id:
        insert_data["room_id"] = str(room_id)
    if detection_event_id:
        insert_data["image_detection_id"] = str(detection_event_id)
    
    db_result = supabase.table("fusion_results").insert(insert_data).execute()
    fusion_record = db_result.data[0] if db_result.data else {}
    
    # Create alert if risk is high or critical
    if risk_level in ("high", "critical"):
        await _create_alert(
            room_id=room_id,
            fusion_result_id=fusion_record.get("id"),
            risk_level=risk_level,
            fusion_score=fusion_score,
        )
    
    # Update room status
    if room_id:
        supabase.table("rooms").update(
            {"status": risk_level}
        ).eq("id", str(room_id)).execute()
    
    return {
        "id": fusion_record.get("id"),
        "fusion_score": fusion_score,
        "risk_level": risk_level,
        "image_score": image_score,
        "sensor_score": sensor_score,
    }


async def _create_alert(
    room_id: Optional[UUID],
    fusion_result_id: Optional[str],
    risk_level: str,
    fusion_score: float,
) -> None:
    """Create an alert record when risk exceeds threshold."""
    severity_map = {"high": "high", "critical": "critical"}
    severity = severity_map.get(risk_level, "medium")
    
    message = (
        f"Fire risk detected — Level: {risk_level.upper()}, "
        f"Fusion score: {fusion_score:.2f}"
    )
    
    insert_data = {
        "severity": severity,
        "alert_type": "fire",
        "message": message,
        "is_acknowledged": False,
    }
    
    if room_id:
        insert_data["room_id"] = str(room_id)
    if fusion_result_id:
        insert_data["fusion_result_id"] = fusion_result_id
    
    res = supabase.table("alerts").insert(insert_data).execute()
    logger.warning(f"ALERT CREATED: {message}")
    
    # Broadcast alert via websocket
    if res.data:
        asyncio.create_task(manager.broadcast({
            "type": "NEW_ALERT",
            "data": res.data[0]
        }))
