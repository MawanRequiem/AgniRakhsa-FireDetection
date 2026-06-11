"""Room management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from app.schemas.room import RoomCreate, RoomUpdate, RoomOut, RoomDetail
from app.api.deps import CurrentUser, OptionalUser, get_subscribed_room_ids
from app.core.db import supabase

router = APIRouter(prefix="/rooms", tags=["rooms"])


def _check_room_access(user: OptionalUser, room_id: str) -> bool:
    """Returns True if user can access this room (admin, guest, or subscribed)."""
    if user is None or user.role == "admin":
        return True
    subscribed = get_subscribed_room_ids(user.id)
    return room_id in subscribed


@router.get("")
@router.get("/")
async def list_rooms(user: OptionalUser = None):
    """List all rooms with device status and sensor counts.
    For basic users, filters to subscribed rooms only.
    """
    query = supabase.table("rooms").select("*").order("created_at")

    if user is not None and user.role == "user":
        subscribed = get_subscribed_room_ids(user.id)
        if subscribed:
            query = query.in_("id", subscribed)
        else:
            return []  # Basic user with no subscriptions → empty list

    res = query.execute()
    rooms = res.data or []

    # Enrich each room with its devices and sensor count
    for room in rooms:
        room_id = room["id"]
        devices_res = supabase.table("devices").select("id, status, name, last_seen").eq("room_id", room_id).execute()
        room["devices"] = devices_res.data or []
        room["device_count"] = len(room["devices"])

        if room["devices"]:
            device_ids = [d["id"] for d in room["devices"]]
            sensors_res = supabase.table("sensors").select("id", count="exact").in_("device_id", device_ids).execute()
            room["sensor_count"] = sensors_res.count or 0
        else:
            room["sensor_count"] = 0

    return rooms


@router.get("/{room_id}", response_model=RoomDetail)
async def get_room(room_id: UUID, user: OptionalUser = None):
    """Get detailed information about a room, including sensors and recent alerts.
    Basic users can only access subscribed rooms.
    """
    if not _check_room_access(user, str(room_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not subscribed to this room",
        )

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


@router.post("", response_model=RoomOut)
@router.post("/", response_model=RoomOut)
async def create_room(room: RoomCreate, current_user: CurrentUser):
    """Create a new room. Admin only."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create rooms",
        )
    res = supabase.table("rooms").insert(room.model_dump(exclude_unset=True)).execute()
    return res.data[0]


@router.patch("/{room_id}", response_model=RoomOut)
async def update_room(room_id: UUID, room: RoomUpdate, current_user: CurrentUser):
    """Update room details. Admin only."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update rooms",
        )
    res = supabase.table("rooms").update(room.model_dump(exclude_unset=True)).eq("id", str(room_id)).execute()
    if not res.data:
        raise HTTPException(404, "Room not found")
    return res.data[0]
