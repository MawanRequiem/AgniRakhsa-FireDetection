"""Device calibration management API endpoints.

Provides endpoints for:
- ESP32 to upload R0 calibration data (Layer 2: Server-Managed)
- Dashboard to view calibration history per device
- Admin to trigger remote recalibration commands
- ESP32 to poll and acknowledge pending commands
"""

from fastapi import APIRouter, HTTPException
from uuid import UUID
from datetime import datetime, timezone

from app.schemas.calibration import (
    CalibrationData,
    CalibrationOut,
    CalibrationCommandRequest,
    CalibrationCommandAck,
    DeviceCommandOut,
)
from app.core.db import supabase

router = APIRouter(prefix="/calibration", tags=["calibration"])


# ─── ESP32 → Server: Upload calibration data ───────────────────────────────

@router.post("/{device_id}", response_model=CalibrationOut)
async def upload_calibration(device_id: UUID, data: CalibrationData):
    """
    Store calibration data (R0 values) from an ESP32 device.
    Called after auto-calibration or remote recalibration completes.
    """
    # Verify device exists
    dev = supabase.table("devices").select("id").eq("id", str(device_id)).execute()
    if not dev.data:
        raise HTTPException(404, "Device not found")

    row = {
        "device_id": str(device_id),
        "r0_mq2": data.r0_mq2,
        "r0_mq4": data.r0_mq4,
        "r0_mq6": data.r0_mq6,
        "r0_mq9": data.r0_mq9,
        "firmware_version": data.firmware_version,
        "source": "auto",
        "calibrated_at": datetime.now(timezone.utc).isoformat(),
    }

    res = supabase.table("device_calibrations").insert(row).execute()
    if not res.data:
        raise HTTPException(500, "Failed to store calibration data")

    return res.data[0]


# ─── Dashboard: View calibration history ────────────────────────────────────

@router.get("/{device_id}/history", response_model=list[CalibrationOut])
async def get_calibration_history(device_id: UUID, limit: int = 10):
    """
    Get calibration history for a device, newest first.
    Useful for dashboard to show calibration drift over time.
    """
    res = (
        supabase.table("device_calibrations")
        .select("*")
        .eq("device_id", str(device_id))
        .order("calibrated_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


@router.get("/{device_id}/latest")
async def get_latest_calibration(device_id: UUID):
    """Get the most recent calibration for a device."""
    res = (
        supabase.table("device_calibrations")
        .select("*")
        .eq("device_id", str(device_id))
        .order("calibrated_at", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return {"calibrated": False, "message": "No calibration data found"}

    return res.data[0]


# ─── Admin → Server: Issue remote command ───────────────────────────────────

@router.post("/{device_id}/command")
async def send_calibration_command(device_id: UUID, req: CalibrationCommandRequest):
    """
    Queue a command for a device (e.g., RECALIBRATE).
    The ESP32 will pick this up on its next heartbeat poll.
    """
    # Verify device exists
    dev = supabase.table("devices").select("id").eq("id", str(device_id)).execute()
    if not dev.data:
        raise HTTPException(404, "Device not found")

    row = {
        "device_id": str(device_id),
        "command": req.command,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    res = supabase.table("device_commands").insert(row).execute()
    if not res.data:
        raise HTTPException(500, "Failed to queue command")

    return {"message": f"Command '{req.command}' queued for device", "command_id": res.data[0]["id"]}


# ─── ESP32 → Server: Poll for pending commands ─────────────────────────────

@router.get("/{device_id}/commands")
async def get_pending_command(device_id: UUID):
    """
    Returns the oldest pending command for a device.
    Called by ESP32 during heartbeat cycle.
    Returns 200 with empty body if no commands pending.
    """
    res = (
        supabase.table("device_commands")
        .select("*")
        .eq("device_id", str(device_id))
        .eq("status", "pending")
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )

    if not res.data:
        return {}

    cmd = res.data[0]
    return {
        "command_id": cmd["id"],
        "command": cmd["command"],
    }

@router.get("/{device_id}/command-status")
async def get_command_status(device_id: UUID):
    """Get the status of any active command for the device."""
    res = (
        supabase.table("device_commands")
        .select("*")
        .eq("device_id", str(device_id))
        .in_("status", ["pending", "in_progress"])
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )

    if not res.data:
        return {"status": "idle"}

    return {
        "status": res.data[0]["status"],
        "command": res.data[0]["command"]
    }


# ─── ESP32 → Server: Acknowledge command completion ────────────────────────

@router.post("/{device_id}/commands/{command_id}/ack")
async def acknowledge_command(device_id: UUID, command_id: UUID, ack: CalibrationCommandAck):
    """
    Mark a command as completed after the ESP32 has executed it.
    """
    res = (
        supabase.table("device_commands")
        .update({
            "status": ack.status,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", str(command_id))
        .eq("device_id", str(device_id))
        .execute()
    )

    if not res.data:
        raise HTTPException(404, "Command not found")

    # Update device status to reflect calibration process
    if ack.status == "in_progress":
        supabase.table("devices").update({"status": "calibrating"}).eq("id", str(device_id)).execute()
    elif ack.status == "completed":
        supabase.table("devices").update({"status": "online"}).eq("id", str(device_id)).execute()

    return {"message": "Command acknowledged", "status": ack.status}
