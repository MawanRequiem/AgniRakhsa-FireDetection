"""Device management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from datetime import datetime, timezone

from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceOut, DeviceHeartbeat, DeviceProvisionRequest, DeviceProvisionResponse
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


@router.post("/provision", response_model=DeviceProvisionResponse)
async def provision_device(req: DeviceProvisionRequest):
    """
    Self-register a device and its sensors by MAC address.
    Returns the mapped sensor UUIDs so the firmware can send batch readings.
    """
    # 1. Resolve room if name provided
    room_id = None
    if req.room_name:
        res = supabase.table("rooms").select("id").eq("name", req.room_name).execute()
        if res.data:
            room_id = res.data[0]["id"]
        else:
            res = supabase.table("rooms").insert({"name": req.room_name, "description": "Auto-provisioned room"}).execute()
            room_id = res.data[0]["id"]
            
    # 2. Resolve or create device
    res = supabase.table("devices").select("id").eq("mac_address", req.mac_address).execute()
    if res.data:
        device_id = res.data[0]["id"]
        # Update room if changed
        if room_id:
            supabase.table("devices").update({"room_id": room_id, "status": "online"}).eq("id", device_id).execute()
        else:
            supabase.table("devices").update({"status": "online"}).eq("id", device_id).execute()
    else:
        res = supabase.table("devices").insert({
            "name": req.name,
            "mac_address": req.mac_address,
            "room_id": room_id,
            "status": "online"
        }).execute()
        device_id = res.data[0]["id"]
        
    # 3. Resolve or create sensors
    res = supabase.table("sensors").select("id, sensor_type").eq("device_id", device_id).execute()
    existing_sensors = {s["sensor_type"]: s["id"] for s in (res.data or [])}
    
    sensor_map = {}
    for stype in req.sensor_types:
        if stype in existing_sensors:
            sensor_map[stype] = existing_sensors[stype]
        else:
            s_res = supabase.table("sensors").insert({
                "device_id": device_id,
                "room_id": room_id,
                "sensor_type": stype,
                "unit": "raw", # Basic default, specific sensors can update this later
                "status": "active"
            }).execute()
            sensor_map[stype] = s_res.data[0]["id"]
            
    return {"device_id": device_id, "sensors": sensor_map}


@router.post("/{device_id}/heartbeat")
async def device_heartbeat(device_id: UUID, heartbeat: DeviceHeartbeat):
    """
    Record that a device is online.
    Does NOT require CSRF to allow lightweight calls from microcontrollers.
    """
    update_data = {
        "status": "online",
        "last_seen": datetime.now(timezone.utc).isoformat()
    }
    if heartbeat.firmware_version:
        update_data["firmware_version"] = heartbeat.firmware_version
        
    res = supabase.table("devices").update(update_data).eq("id", str(device_id)).execute()
    if not res.data:
        raise HTTPException(404, "Device not found")
        
    return {"status": "ok"}


@router.patch("/{device_id}", response_model=DeviceOut)
async def update_device(device_id: UUID, update: DeviceUpdate):
    """Update device fields (name, room assignment, firmware, status)."""
    data = update.model_dump(exclude_unset=True)
    if "room_id" in data and data["room_id"] is not None:
        data["room_id"] = str(data["room_id"])

    if not data:
        raise HTTPException(400, "No fields to update")

    res = supabase.table("devices").update(data).eq("id", str(device_id)).execute()
    if not res.data:
        raise HTTPException(404, "Device not found")
    return res.data[0]
