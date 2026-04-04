"""Device management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from datetime import datetime

from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceOut, DeviceHeartbeat
from app.api.deps import CurrentUser
from app.core.db import supabase

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("/", response_model=list[DeviceOut])
async def list_devices(room_id: UUID | None = None):
    """List all IoT devices."""
    query = supabase.table("devices").select("*")
    if room_id:
        query = query.eq("room_id", str(room_id))
    
    res = query.order("created_at", desc=True).execute()
    return res.data or []


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(device_id: UUID):
    """Get device details."""
    res = supabase.table("devices").select("*").eq("id", str(device_id)).execute()
    if not res.data:
        raise HTTPException(404, "Device not found")
    return res.data[0]


@router.post("/", response_model=DeviceOut)
async def register_device(device: DeviceCreate):
    """Register a new IoT device."""
    # Check MAC address uniqueness if provided
    if device.mac_address:
        existing = supabase.table("devices").select("id").eq("mac_address", device.mac_address).execute()
        if existing.data:
            raise HTTPException(400, "MAC address already registered")
            
    # Serialize UUID
    data = device.model_dump(exclude_unset=True)
    if "room_id" in data and data["room_id"] is not None:
        data["room_id"] = str(data["room_id"])
        
    res = supabase.table("devices").insert(data).execute()
    return res.data[0]


@router.post("/{device_id}/heartbeat")
async def device_heartbeat(device_id: UUID, heartbeat: DeviceHeartbeat):
    """
    Record that a device is online.
    Does NOT require CSRF to allow lightweight calls from microcontrollers.
    """
    update_data = {
        "status": "online",
        "last_seen": datetime.utcnow().isoformat()
    }
    if heartbeat.firmware_version:
        update_data["firmware_version"] = heartbeat.firmware_version
        
    res = supabase.table("devices").update(update_data).eq("id", str(device_id)).execute()
    if not res.data:
        raise HTTPException(404, "Device not found")
        
    return {"status": "ok"}
