"""
Late Fusion Service — Combines image + sensor ML model outputs.

Architecture:
  Image Model (YOLO) ──→ image_score ──┐
                                        ├──→ fusion_score ──→ risk_level ──→ alert?
  Sensor Model (Isolation Forest) ──→ ──┘
  
Fusion formula:
  fusion_score = (FUSION_WEIGHT_IMAGE * image_score) + (FUSION_WEIGHT_SENSOR * sensor_score)

Sensor scoring uses dual-path strategy:
  1. Primary: Isolation Forest ML model (if loaded and has enough data)
  2. Fallback: Rule-based threshold scoring on raw sensor values
"""

import logging
import asyncio
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from app.core.config import settings
from app.core.db import supabase
from app.services import sensor_service
from app.api.ws_manager import manager
from app.services.whatsapp import send_whatsapp_message
from app.ai import registry

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

# Human-readable sensor names for WhatsApp messages (layman Indonesian)
SENSOR_DISPLAY_NAMES = {
    "mq2": ("Asap", "ppm"),
    "mq4": ("Gas Metana (CNG)", "ppm"),
    "mq6": ("Gas LPG", "ppm"),
    "mq9b": ("Karbon Monoksida (CO)", "ppm"),
    "flame": ("Sensor Api Inframerah", ""),
    "shtc3_temp": ("Suhu Ruangan", "°C"),
    "shtc3_humidity": ("Kelembaban", "%"),
    "MQ2": ("Asap", "ppm"),
    "MQ4": ("Gas Metana (CNG)", "ppm"),
    "MQ6": ("Gas LPG", "ppm"),
    "MQ9B": ("Karbon Monoksida (CO)", "ppm"),
    "FLAME": ("Sensor Api Inframerah", ""),
    "SHTC3_TEMP": ("Suhu Ruangan", "°C"),
    "SHTC3_HUMIDITY": ("Kelembaban", "%"),
}

# Alert cooldown per room to prevent spam (room_id → last_alert_timestamp)
_alert_cooldowns: dict[str, float] = {}
ALERT_COOLDOWN_SECONDS = 60  # Minimum 60 seconds between alerts for the same room


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

        if isinstance(data, dict):
            value = data.get("value")
        elif isinstance(data, (int, float)):
            value = float(data)
        else:
            logger.warning(
                f"Invalid sensor snapshot format for {sensor_type}: {data}"
            )
            continue

        if value is None:
            continue
        
        thresholds = SENSOR_THRESHOLDS.get(sensor_type.lower())
        if thresholds is None:
            continue
        
        safe_max, warning, danger = thresholds[0], thresholds[1], thresholds[2]
        
        # Special handling: flame sensor is inverted (lower value = more fire)
        if sensor_type.lower() == "flame":
            if value <= danger:
                score = 1.0
            elif value <= warning:
                score = 0.5 + 0.5 * (warning - value) / (warning - danger)
            elif value <= safe_max:
                score = 0.2 * (safe_max - value) / (safe_max - warning)
            else:
                score = 0.0
        # Humidity: lower = drier = more fire risk
        elif sensor_type.lower() == "shtc3_humidity":
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


def _format_sensor_details_for_wa(snapshot: dict) -> str:
    """
    Format sensor data into a human-readable string for WhatsApp notification.
    Uses layman Indonesian language.
    """
    if not snapshot:
        return "• Data sensor tidak tersedia saat ini"

    lines = []
    for sensor_key, value in snapshot.items():
        if isinstance(value, dict):
            val = value.get("value")
        elif isinstance(value, (int, float)):
            val = value
        else:
            continue

        if val is None:
            continue

        display = SENSOR_DISPLAY_NAMES.get(sensor_key)
        if display:
            name, unit = display
            if unit:
                lines.append(f"  • {name}: {val:.1f} {unit}")
            else:
                # Flame sensor: interpret raw value
                if "flame" in sensor_key.lower():
                    status = "🔥 API TERDETEKSI" if val < 1500 else "Normal"
                    lines.append(f"  • {name}: {status}")
                else:
                    lines.append(f"  • {name}: {val:.1f}")

    return "\n".join(lines) if lines else "  • Data sensor tidak tersedia"


async def run_fusion(
    image_score: float,
    room_id: Optional[UUID] = None,
    detection_event_id: Optional[UUID] = None,
    sensor_snapshot: Optional[dict] = None,
    image_url: Optional[str] = None,
) -> dict:
    """
    Run late fusion combining image and sensor scores.
    
    Uses dual-path sensor scoring:
      1. Isolation Forest ML model (if loaded and room has enough data)
      2. Rule-based threshold fallback
    
    Args:
        image_score: Confidence from the image model (0-1).
        room_id: Room to pull sensor data from (if snapshot not provided).
        detection_event_id: FK to the detection_events record.
        sensor_snapshot: Pre-built sensor data dict. If None, fetched from DB.
        image_url: Public URL of captured fire detection image (if available).
        
    Returns:
        Dict with fusion_score, risk_level, and the stored fusion_result ID.
    """
    # Get sensor snapshot if not provided
    if sensor_snapshot is None and room_id:
        sensor_snapshot = await sensor_service.get_room_sensor_snapshot(room_id)
    
    if sensor_snapshot is None:
        sensor_snapshot = {}
    
    # ─── Compute Sensor Score: ML Model → Threshold Fallback ──────────────
    algorithm = "v1.0-threshold-fallback"
    try:
        sensor_detector = registry.get_sensor_detector()
        if room_id and sensor_detector.has_enough_data(str(room_id)):
            sensor_score = sensor_detector.predict(str(room_id))
            algorithm = "v2.0-isolation-forest"
            logger.info(
                f"IF model used for room {room_id}: "
                f"sensor_score={sensor_score:.4f}, "
                f"buffer_status={sensor_detector.get_buffer_status()}"
            )
        else:
            sensor_score = _compute_sensor_score_from_thresholds(sensor_snapshot)
            if room_id and sensor_detector.is_loaded:
                buf_status = sensor_detector.get_buffer_status()
                room_buf = buf_status.get(str(room_id), 0)
                logger.debug(
                    f"IF model not ready for room {room_id}: "
                    f"{room_buf}/9 samples. Using threshold fallback."
                )
    except RuntimeError:
        # Sensor model not loaded — use threshold fallback
        sensor_score = _compute_sensor_score_from_thresholds(sensor_snapshot)
    
    # ─── Weighted Late Fusion ─────────────────────────────────────────────
    fusion_score = (
        settings.FUSION_WEIGHT_IMAGE * image_score
        + settings.FUSION_WEIGHT_SENSOR * sensor_score
    )
    fusion_score = min(max(fusion_score, 0.0), 1.0)
    
    risk_level = _score_to_risk_level(fusion_score)
    
    logger.info(
        f"Fusion result: image={image_score:.3f} sensor={sensor_score:.3f} "
        f"fusion={fusion_score:.3f} risk={risk_level} algo={algorithm}"
    )
    
    # Store fusion result
    insert_data = {
        "image_score": image_score,
        "sensor_score": sensor_score,
        "fusion_score": fusion_score,
        "risk_level": risk_level,
        "sensor_snapshot": sensor_snapshot,
        "algorithm_version": algorithm,
    }
    
    if room_id:
        insert_data["room_id"] = str(room_id)
    if detection_event_id:
        insert_data["image_detection_id"] = str(detection_event_id)
    
    db_result = supabase.table("fusion_results").insert(insert_data).execute()
    fusion_record = db_result.data[0] if db_result.data else {}
    
    # Create alert if risk is high or critical (with cooldown)
    if risk_level in ("high", "critical"):
        await _create_alert(
            room_id=room_id,
            fusion_result_id=fusion_record.get("id"),
            risk_level=risk_level,
            fusion_score=fusion_score,
            sensor_snapshot=sensor_snapshot,
            image_url=image_url,
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
    sensor_snapshot: Optional[dict] = None,
    image_url: Optional[str] = None,
) -> None:
    """
    Create an alert record when risk exceeds threshold.
    
    Includes:
    - Alert cooldown per room (prevents notification spam)
    - WebSocket broadcast for real-time frontend notification
    - WhatsApp notification with layman Indonesian language + image
    """
    import time as _time

    # ─── Cooldown Check ───────────────────────────────────────────────────
    room_key = str(room_id) if room_id else "global"
    now = _time.time()
    last_alert = _alert_cooldowns.get(room_key, 0)
    if now - last_alert < ALERT_COOLDOWN_SECONDS:
        logger.info(
            f"Alert cooldown active for room {room_key}. "
            f"Skipping alert ({now - last_alert:.0f}s < {ALERT_COOLDOWN_SECONDS}s)"
        )
        return
    _alert_cooldowns[room_key] = now

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
    if image_url:
        insert_data["image_url"] = image_url
    
    res = supabase.table("alerts").insert(insert_data).execute()
    logger.warning(f"ALERT CREATED: {message}")
    
    # ─── WebSocket Broadcast (real-time frontend notification) ────────────
    if res.data:
        alert_data = res.data[0]
        # Enrich with image_url for frontend
        if image_url and "image_url" not in alert_data:
            alert_data["image_url"] = image_url

        # Fetch room name for enriched frontend data
        room_name = "Ruangan Tidak Diketahui"
        if room_id:
            room_res = supabase.table("rooms").select("name, floor, building_name").eq("id", str(room_id)).execute()
            if room_res.data:
                room_data = room_res.data[0]
                room_name = room_data.get("name", room_name)
                floor = room_data.get("floor", "")
                building = room_data.get("building_name", "")
                if floor:
                    room_name = f"{room_name}, {floor}"
                if building:
                    room_name = f"{room_name} — {building}"

        # Broadcast NEW_ALERT for the existing alert panel in header
        asyncio.create_task(manager.broadcast({
            "type": "NEW_ALERT",
            "data": alert_data
        }))

        # Broadcast dedicated FIRE_ALERT for the toast notification system
        asyncio.create_task(manager.broadcast({
            "type": "FIRE_ALERT",
            "data": {
                "alert_id": alert_data.get("id"),
                "room_name": room_name,
                "severity": severity,
                "risk_level": risk_level,
                "fusion_score": fusion_score,
                "image_url": image_url,
                "sensor_summary": _format_sensor_details_for_wa(sensor_snapshot),
                "timestamp": alert_data.get("created_at"),
            }
        }))

        # ─── WhatsApp Notification ────────────────────────────────────────
        contacts_res = supabase.table("contacts").select("phone, name").eq("is_active", True).execute()
        active_contacts = contacts_res.data
        
        if active_contacts:
            # Build sensor detail text
            sensor_details = _format_sensor_details_for_wa(sensor_snapshot)
            
            # Risk level in Indonesian
            risk_labels = {
                "critical": "🔴 KRITIS",
                "high": "🟠 TINGGI",
            }
            risk_display = risk_labels.get(risk_level, risk_level.upper())
            
            # Determine what was detected
            detection_sources = []
            if sensor_snapshot:
                # Check for flame sensor
                flame_val = sensor_snapshot.get("FLAME") or sensor_snapshot.get("flame")
                if flame_val is not None:
                    fv = flame_val if isinstance(flame_val, (int, float)) else flame_val.get("value", 9999)
                    if fv < 1500:
                        detection_sources.append("🔥 Api terdeteksi oleh sensor inframerah")
                
                # Check for high gas
                for gas_key in ("MQ2", "mq2"):
                    gas_val = sensor_snapshot.get(gas_key)
                    if gas_val is not None:
                        gv = gas_val if isinstance(gas_val, (int, float)) else gas_val.get("value", 0)
                        if gv > 500:
                            detection_sources.append("💨 Kadar asap tinggi terdeteksi")
                            break
                
                # Check for high temp
                for temp_key in ("SHTC3_TEMP", "shtc3_temp"):
                    temp_val = sensor_snapshot.get(temp_key)
                    if temp_val is not None:
                        tv = temp_val if isinstance(temp_val, (int, float)) else temp_val.get("value", 0)
                        if tv > 55:
                            detection_sources.append(f"🌡️ Suhu ruangan sangat tinggi ({tv:.0f}°C)")
                            break

            detection_text = "\n".join(detection_sources) if detection_sources else "📷 Kamera mendeteksi potensi api"

            wa_message = (
                f"🚨 *PERINGATAN KEBAKARAN — AgniRaksha*\n\n"
                f"Sistem kami mendeteksi kemungkinan kebakaran.\n\n"
                f"📍 *Lokasi:* {room_name}\n"
                f"⚠️ *Tingkat Bahaya:* {risk_display} ({fusion_score*100:.0f}%)\n\n"
                f"🔍 *Apa yang terdeteksi:*\n"
                f"{detection_text}\n\n"
                f"📊 *Data Sensor Saat Ini:*\n"
                f"{sensor_details}\n\n"
                f"🛡️ *Yang Harus Dilakukan:*\n"
                f"1. Segera cek lokasi secara visual\n"
                f"2. Siapkan Alat Pemadam Api Ringan (APAR)\n"
                f"3. Hubungi petugas keamanan gedung\n"
                f"4. Evakuasi penghuni jika api membesar\n\n"
            )

            if image_url:
                wa_message += f"📸 Foto terlampir dari kamera pengawas.\n\n"

            wa_message += f"_Pesan otomatis dari Sistem AgniRaksha_"
            
            # Send to all active contacts as background tasks
            for contact in active_contacts:
                phone = contact.get("phone")
                if phone:
                    asyncio.create_task(
                        send_whatsapp_message(
                            phone=phone,
                            message=wa_message,
                            image_url=image_url
                        )
                    )
