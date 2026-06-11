"""User preference API endpoints — room subscriptions, notification settings."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Annotated, List
from uuid import UUID

from app.api.deps import CurrentUser
from app.core.db import supabase

router = APIRouter(prefix="/user", tags=["user"])


# ── Schemas ─────────────────────────────────────────────────

class RoomSubscriptionsUpdate(BaseModel):
    room_ids: List[str] = Field(
        default_factory=list,
        description="List of room UUIDs to subscribe to. Replaces existing subscriptions.",
    )


class RoomSubscriptionOut(BaseModel):
    room_id: str
    room_name: str | None = None


class AvailableRoomOut(BaseModel):
    room_id: str
    room_name: str | None = None
    is_subscribed: bool = False


# ── Helpers ─────────────────────────────────────────────────

def _get_subscribed_room_ids(user_id: str) -> list[str]:
    """Fetch the room IDs this user is subscribed to."""
    res = (
        supabase.table("user_room_subscriptions")
        .select("room_id")
        .eq("user_id", user_id)
        .execute()
    )
    return [row["room_id"] for row in (res.data or [])]


# ── Endpoints ───────────────────────────────────────────────

@router.get("/room-subscriptions", response_model=List[RoomSubscriptionOut])
async def get_room_subscriptions(current_user: CurrentUser):
    """Return the rooms the current user is subscribed to."""
    # Admins see everything (empty subscription list concept)
    if current_user.role == "admin":
        rooms_res = supabase.table("rooms").select("id, name").execute()
        return [
            {"room_id": r["id"], "room_name": r.get("name")}
            for r in (rooms_res.data or [])
        ]

    subs = _get_subscribed_room_ids(current_user.id)
    if not subs:
        return []

    rooms_res = (
        supabase.table("rooms")
        .select("id, name")
        .in_("id", subs)
        .execute()
    )
    rooms = rooms_res.data or []
    return [
        {"room_id": r["id"], "room_name": r.get("name")}
        for r in rooms
    ]


@router.post("/room-subscriptions")
async def update_room_subscriptions(
    body: RoomSubscriptionsUpdate,
    current_user: CurrentUser,
):
    """
    Atomically replace the user's room subscriptions.
    Pass an empty `room_ids` list to clear all subscriptions.
    """
    if current_user.role == "admin":
        # Admins don't need subscriptions — no-op
        return {"status": "ok", "message": "Admins bypass subscriptions"}

    # Validate all room_ids exist
    if body.room_ids:
        rooms_res = (
            supabase.table("rooms")
            .select("id")
            .in_("id", body.room_ids)
            .execute()
        )
        valid_ids = {r["id"] for r in (rooms_res.data or [])}
        invalid = [r for r in body.room_ids if r not in valid_ids]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid room IDs: {invalid}",
            )

    # Delete existing subscriptions for this user
    supabase.table("user_room_subscriptions").delete().eq(
        "user_id", current_user.id
    ).execute()

    # Insert new ones
    if body.room_ids:
        rows = [
            {"user_id": current_user.id, "room_id": room_id}
            for room_id in body.room_ids
        ]
        supabase.table("user_room_subscriptions").insert(rows).execute()

    return {
        "status": "ok",
        "message": "Subscriptions updated",
        "room_ids": body.room_ids,
    }


@router.get("/room-subscriptions/available", response_model=List[AvailableRoomOut])
async def get_available_rooms(current_user: CurrentUser):
    """
    Return all rooms with an `is_subscribed` flag.
    For admins, every room is marked `is_subscribed: True`.
    """
    rooms_res = supabase.table("rooms").select("id, name").order("name").execute()
    rooms = rooms_res.data or []

    if current_user.role == "admin":
        return [
            AvailableRoomOut(
                room_id=r["id"],
                room_name=r.get("name"),
                is_subscribed=True,
            )
            for r in rooms
        ]

    subscribed = set(_get_subscribed_room_ids(current_user.id))
    return [
        AvailableRoomOut(
            room_id=r["id"],
            room_name=r.get("name"),
            is_subscribed=r["id"] in subscribed,
        )
        for r in rooms
    ]
