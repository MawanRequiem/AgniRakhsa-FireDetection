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
from app.ai.iot_sensor.detector import SENSOR_TYPE_MAP

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
    "flame":        (3000,  2000,   1000,  "raw"),    # Analog IR: lower = fire detected
    "shtc3_temp":   (40,    55,     70,    "°C"),     # Temperature
    "shtc3_humidity":(80,   60,     40,    "%RH"),    # Humidity (lower = drier = more risk)
}

# Human-readable sensor names for WhatsApp messages (layman Indonesian)
# Keys are UPPERCASE. Use .upper() at lookup time for case-insensitive matching.
SENSOR_DISPLAY_NAMES = {
    "MQ2": ("Asap", "ppm"),
    "MQ4": ("Gas Metana (CNG)", "ppm"),
    "MQ6": ("Gas LPG", "ppm"),
    "MQ9B": ("Karbon Monoksida (CO)", "ppm"),
    "FLAME": ("Sensor Api Inframerah", "raw"),
    "SHTC3_TEMP": ("Suhu Ruangan", "°C"),
    "SHTC3_HUMIDITY": ("Kelembaban", "%"),
}

# WhatsApp per-contact cooldown to prevent flooding individuals
# Key: f"{room_id}:{phone}", Value: timestamp of last message sent
_wa_contact_cooldowns: dict[str, float] = {}


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
        
        # FLAME sensor: analog IR, lower value = more fire risk (inverted)
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


def score_sensors(room_id: Optional[str], snapshot: Optional[dict] = None) -> tuple[float, str]:
    """
    Shared dual-path sensor scoring with IF sanity gate.
    
    Used by both fusion_service.run_fusion() and fusion_worker._evaluate_sensor_risk()
    to ensure consistent scoring logic across all fusion paths.
    
    Returns:
        Tuple of (sensor_score, algorithm_version_string).
    """
    if snapshot is None:
        snapshot = {}
    
    algorithm = "v1.0-threshold-fallback"
    threshold_score = _compute_sensor_score_from_thresholds(snapshot)
    
    try:
        sensor_detector = registry.get_sensor_detector()
        if room_id and sensor_detector.has_enough_data(str(room_id)):
            if_score = sensor_detector.predict(str(room_id))
            algorithm = "v2.0-isolation-forest"
            
            # ─── IF Sanity Gate ────────────────────────────────────────
            # The IF model can hallucinate on normal data (e.g. when disabled
            # sensors produce zero-features). If ALL threshold-based scores
            # indicate SAFE (< 0.15), clamp the IF score to prevent false alerts.
            IF_SANITY_FLOOR = 0.15
            if threshold_score < IF_SANITY_FLOOR and if_score > 0.4:
                logger.warning(
                    f"IF sanity gate triggered for room {room_id}: "
                    f"IF says {if_score:.3f} but thresholds say {threshold_score:.3f}. "
                    f"Clamping to threshold score (IF likely hallucinating)."
                )
                sensor_score = threshold_score
                algorithm += "+sanity-clamped"
            else:
                # If the IF model doesn't cover flame/temperature/humidity,
                # we must ensure that critical threshold detections on those
                # uncovered sensors are not suppressed by the IF score.
                uncovered_sensors = {}
                for s_type, val in snapshot.items():
                    training_name = SENSOR_TYPE_MAP.get(s_type.upper())
                    if training_name is None or training_name not in getattr(sensor_detector, "_training_columns", []):
                        uncovered_sensors[s_type] = val
                
                if uncovered_sensors:
                    uncovered_threshold_score = _compute_sensor_score_from_thresholds(uncovered_sensors)
                    if uncovered_threshold_score > if_score:
                        logger.info(
                            f"Uncovered sensors threshold override for room {room_id}: "
                            f"IF score={if_score:.3f}, uncovered threshold score="
                            f"{uncovered_threshold_score:.3f}. Using threshold score."
                        )
                        sensor_score = uncovered_threshold_score
                        algorithm += "+uncovered-override"
                    else:
                        sensor_score = if_score
                else:
                    sensor_score = if_score
            
            logger.info(
                f"IF model used for room {room_id}: "
                f"if_raw={if_score:.4f}, threshold={threshold_score:.4f}, "
                f"final_sensor={sensor_score:.4f}, "
                f"buffer_status={sensor_detector.get_buffer_status()}"
            )
        else:
            sensor_score = threshold_score
            if room_id and sensor_detector.is_loaded:
                buf_status = sensor_detector.get_buffer_status()
                room_buf = buf_status.get(str(room_id), 0)
                logger.debug(
                    f"IF model not ready for room {room_id}: "
                    f"{room_buf}/9 samples. Using threshold fallback."
                )
    except RuntimeError:
        # Sensor model not loaded — use threshold fallback
        sensor_score = threshold_score
    
    return sensor_score, algorithm


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

        display = SENSOR_DISPLAY_NAMES.get(sensor_key.upper())
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
    sensor_score, algorithm = score_sensors(room_id, sensor_snapshot)
    
    # ─── Weighted Late Fusion ─────────────────────────────────────────────
    # Dynamic weight rebalancing:
    #   - Normal mode (camera active): 60% image + 40% sensor
    #   - Sensor-only mode (no camera): 100% sensor (rebalanced)
    #   - Image-only mode (no sensor):  100% image  (rebalanced)
    # This ensures sensor spikes can independently trigger alerts.
    
    is_sensor_only = image_score == 0.0 and sensor_score > 0.0
    is_image_only = sensor_score == 0.0 and image_score > 0.0
    
    if is_sensor_only:
        # Sensor-only: sensor drives the full score
        fusion_score = sensor_score
        algorithm += "+sensor-only"
        logger.info(
            f"Sensor-only mode: rebalanced weights to 100% sensor "
            f"(sensor_score={sensor_score:.3f})"
        )
    elif is_image_only:
        # Image-only: camera drives the full score
        fusion_score = image_score
        algorithm += "+image-only"
    else:
        # Normal late fusion: both sources available
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
        should_update = True
        if risk_level == "safe":
            try:
                active_res = (
                    supabase.table("alerts")
                    .select("id")
                    .eq("room_id", str(room_id))
                    .eq("is_acknowledged", False)
                    .execute()
                )
                if active_res.data:
                    should_update = False
                    logger.info(f"Skipping room status update to 'safe' for room {room_id} because there are unacknowledged alerts.")
            except Exception as e:
                logger.error(f"Error checking active alerts in run_fusion: {e}")
                
        if should_update:
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

    room_key = str(room_id) if room_id else "global"
    now = _time.time()

    # ─── Three-Rule State-Change Alerting ─────────────────────────────────
    # Rule 1: If unacknowledged alert exists with SAME risk_level → SKIP (spam)
    # Rule 2: If unacknowledged alert exists with LOWER risk_level → KIRIM (escalation)
    # Rule 3: No unacknowledged alerts → check grace period since LAST alert

    risk_rank = {"high": 1, "critical": 2}

    try:
        last_unack = (
            supabase.table("alerts")
            .select("id, risk_level, created_at")
            .eq("room_id", room_key)
            .eq("is_acknowledged", False)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if last_unack.data:
            last_unack_level = last_unack.data[0].get("risk_level")

            if last_unack_level == risk_level:
                logger.info(
                    f"Alert suppressed for room {room_key}: "
                    f"unacknowledged {last_unack_level} alert already active "
                    f"(Rule 1: same risk_level)"
                )
                return

            if risk_rank.get(last_unack_level, 0) < risk_rank.get(risk_level, 0):
                logger.warning(
                    f"ESCALATION for room {room_key}: "
                    f"{last_unack_level} → {risk_level}. Bypassing all cooldowns."
                )
            else:
                logger.info(
                    f"Alert suppressed for room {room_key}: "
                    f"risk_level decreased ({last_unack_level} → {risk_level})"
                )
                return
        else:
            # Rule 3: No unacknowledged alerts — check grace period since ANY last alert
            last_any = (
                supabase.table("alerts")
                .select("id, risk_level, created_at")
                .eq("room_id", room_key)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )

            if last_any.data:
                last_alert_time_str = last_any.data[0].get("created_at")
                if last_alert_time_str:
                    try:
                        last_alert_dt = datetime.fromisoformat(
                            last_alert_time_str.replace("Z", "+00:00")
                        )
                        elapsed = (datetime.now(timezone.utc) - last_alert_dt).total_seconds()
                        if elapsed < settings.ALERT_COOLDOWN_SECONDS:
                            logger.info(
                                f"Alert suppressed for room {room_key}: "
                                f"post-ACK grace period ({elapsed:.0f}s < "
                                f"{settings.ALERT_COOLDOWN_SECONDS}s since last alert)"
                            )
                            return
                    except (ValueError, TypeError) as e:
                        logger.warning(
                            f"Could not parse last alert time for room {room_key}: {e}. "
                            f"Allowing alert."
                        )

    except Exception as e:
        logger.error(
            f"Error during state-change check for room {room_key}: {e}. "
            f"Allowing alert as safety fallback."
        )

    severity_map = {"high": "high", "critical": "critical"}
    severity = severity_map.get(risk_level, "medium")
    
    # Fetch room name first so we can include it in the layperson message
    room_name = "Ruangan Tidak Diketahui"
    if room_id:
        try:
            room_res = supabase.table("rooms").select("name, floor, building_name").eq("id", str(room_id)).execute()
            if room_res.data:
                room_data = room_res.data[0]
                r_name = room_data.get("name", "")
                floor = room_data.get("floor", "")
                building = room_data.get("building_name", "")
                
                parts = []
                if r_name:
                    parts.append(r_name)
                if floor:
                    parts.append(floor)
                if building:
                    parts.append(building)
                
                if parts:
                    room_name = " — ".join(parts)
        except Exception as e:
            logger.error(f"Error fetching room details: {e}")

    # Build layperson detection description
    reasons = []
    if sensor_snapshot:
        flame_val = sensor_snapshot.get("FLAME") or sensor_snapshot.get("flame")
        if flame_val is not None:
            fv = flame_val if isinstance(flame_val, (int, float)) else flame_val.get("value", 9999)
            if fv < 1500:
                reasons.append("sensor mendeteksi adanya api")
        
        for gas_key in ("MQ2", "mq2"):
            gas_val = sensor_snapshot.get(gas_key)
            if gas_val is not None:
                gv = gas_val if isinstance(gas_val, (int, float)) else gas_val.get("value", 0)
                if gv > 500:
                    reasons.append("asap tebal terdeteksi")
                    break
        
        for temp_key in ("SHTC3_TEMP", "shtc3_temp"):
            temp_val = sensor_snapshot.get(temp_key)
            if temp_val is not None:
                tv = temp_val if isinstance(temp_val, (int, float)) else temp_val.get("value", 0)
                if tv > 55:
                    reasons.append(f"suhu ruangan sangat panas ({tv:.1f}°C)")
                    break

    if reasons and image_url:
        detect_desc = "Kamera pengawas dan sensor mendeteksi " + " serta ".join(reasons)
    elif image_url:
        detect_desc = "Kamera pengawas mendeteksi adanya potensi kobaran api"
    elif reasons:
        detect_desc = "Sensor ruangan mendeteksi " + " serta ".join(reasons)
    else:
        detect_desc = "Sistem mendeteksi adanya kejanggalan suhu atau kondisi udara"

    if risk_level == "critical":
        message = f"🚨 BAHAYA KEBAKARAN di {room_name}! {detect_desc}. Segera amankan area dan evakuasi!"
    else:
        message = f"⚠️ PERINGATAN BAHAYA di {room_name}! {detect_desc}. Harap segera periksa lokasi."
    
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
                # Check flame sensor (analog IR: lower value = fire detected)
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

            if detection_sources:
                detection_text = "\n".join(detection_sources)
            elif image_url:
                detection_text = "📷 Kamera mendeteksi potensi api"
            else:
                detection_text = "🤖 Sensor mendeteksi anomali lingkungan"

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
            # Per-contact rate limiting to prevent flooding individuals
            for contact in active_contacts:
                phone = contact.get("phone")
                if not phone:
                    continue

                wa_key = f"{room_key}:{phone}"
                last_wa = _wa_contact_cooldowns.get(wa_key, 0)
                if now - last_wa < settings.WA_CONTACT_COOLDOWN_SECONDS:
                    logger.info(
                        f"WA rate limit for {wa_key}: "
                        f"({now - last_wa:.0f}s < {settings.WA_CONTACT_COOLDOWN_SECONDS}s)"
                    )
                    continue

                _wa_contact_cooldowns[wa_key] = now
                asyncio.create_task(
                    send_whatsapp_message(
                        phone=phone,
                        message=wa_message,
                        image_url=image_url,
                        room_id=room_key,
                    )
                )
