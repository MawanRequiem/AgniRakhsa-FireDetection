"""Room management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID

from app.schemas.room import RoomCreate, RoomUpdate, RoomOut, RoomDetail
from app.api.deps import CurrentUser
from app.core.db import supabase

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("/", response_model=list[RoomOut])
async def list_rooms():
    """List all rooms."""
    res = supabase.table("rooms").select("*").order("created_at").execute()
    return res.data or []


@router.get("/{room_id}", response_model=RoomDetail)
async def get_room(room_id: UUID):
    """Get detailed information about a room, including sensors and recent alerts."""
    res = supabase.table("rooms").select("*").eq("id", str(room_id)).execute()
    if not res.data:
        raise HTTPException(404, "Room not found")
        
    room = res.data[0]
    
    # Get associated devices
    devices_res = supabase.table("devices").select("*").eq("room_id", str(room_id)).execute()
    room["devices"] = devices_res.data or []
    
    # Get active alerts
    alerts_res = (
        supabase.table("alerts")
        .select("*")
        .eq("room_id", str(room_id))
        .eq("is_acknowledged", False)
        .order("created_at", desc=True)
        .execute()
    )
    room["active_alerts"] = alerts_res.data or []
    
    # Get sensor count (via devices)
    room["sensor_count"] = 0
    if room["devices"]:
        device_ids = [d["id"] for d in room["devices"]]
        sensors_res = supabase.table("sensors").select("id", count="exact").in_("device_id", device_ids).execute()
        room["sensor_count"] = sensors_res.count or 0
        
    return room


@router.post("/", response_model=RoomOut)
async def create_room(room: RoomCreate):
    """Create a new room."""
    res = supabase.table("rooms").insert(room.model_dump(exclude_unset=True)).execute()
    return res.data[0]


@router.patch("/{room_id}", response_model=RoomOut)
async def update_room(room_id: UUID, room: RoomUpdate):
    """Update room details."""
    res = supabase.table("rooms").update(room.model_dump(exclude_unset=True)).eq("id", str(room_id)).execute()
    if not res.data:
        raise HTTPException(404, "Room not found")
    return res.data[0]
