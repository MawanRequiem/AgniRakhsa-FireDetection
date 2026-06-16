"""Alert management API endpoints."""

from fastapi import APIRouter, HTTPException, status
from uuid import UUID
from datetime import datetime, timezone
from collections import defaultdict

from app.schemas.alert import (
    AlertOut,
    AlertAcknowledge,
    AlertsResponse,
    RoomSummaryRequest,
    RoomSummaryResponse,
    AcknowledgeRoomResponse,
)
from app.core.db import supabase
from app.api.deps import OptionalUser, CurrentUser, get_subscribed_room_ids

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _check_alert_access(user: OptionalUser, room_id: str | None) -> bool:
    """Returns True if user can access alerts for this room."""
    if user is None or user.role == "admin":
        return True
    if room_id is None:
        return False
    subscribed = get_subscribed_room_ids(user.id)
    return room_id in subscribed


@router.get("", response_model=AlertsResponse)
@router.get("/", response_model=AlertsResponse)
async def list_alerts(
    page: int = 1,
    page_size: int = 30,
    severity: str | None = None,
    room_id: UUID | None = None,
    acknowledged: bool | None = None,
    user: OptionalUser = None,
):
    """Paginated, filterable list of all system alerts.
    For basic users, filters to subscribed rooms only.
    Returns room_name injected into each item via batch join.
    """
    offset = (page - 1) * page_size

    query = supabase.table("alerts").select("*", count="exact")

    if severity:
        query = query.eq("severity", severity)
    if room_id:
        query = query.eq("room_id", str(room_id))
    if acknowledged is not None:
        query = query.eq("is_acknowledged", acknowledged)

    # Role-based room filtering
    if user is not None and user.role == "user":
        subscribed = get_subscribed_room_ids(user.id)
        # If the caller also passed room_id, ensure it's in their subscriptions
        if room_id is not None and str(room_id) not in subscribed:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}
        if room_id is None and subscribed:
            query = query.in_("room_id", subscribed)
        elif room_id is None and not subscribed:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}

    result = (
        query
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    items = result.data or []

    # ── Batch-inject room_name into each alert item ──
    room_ids = list({item["room_id"] for item in items if item.get("room_id")})
    room_name_map: dict[str, str] = {}
    if room_ids:
        room_res = (
            supabase.table("rooms")
            .select("id, name")
            .in_("id", room_ids)
            .execute()
        )
        for r in (room_res.data or []):
            room_name_map[r["id"]] = r.get("name", "Unknown Room")

    for item in items:
        item["room_name"] = room_name_map.get(item.get("room_id", ""), None)

    return {
        "items": items,
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }



@router.patch("/{alert_id}/acknowledge", response_model=AlertOut)
async def acknowledge_alert(
    alert_id: UUID,
    body: AlertAcknowledge,
    user: CurrentUser,
):
    """Mark an alert as acknowledged. Basic users can only ack alerts in subscribed rooms."""
    # Fetch alert to check room access
    alert_res = supabase.table("alerts").select("room_id").eq("id", str(alert_id)).execute()
    if not alert_res.data:
        raise HTTPException(404, "Alert not found")

    alert_room_id = alert_res.data[0].get("room_id")
    if not _check_alert_access(user, alert_room_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to acknowledge this alert",
        )

    update_data = {
        "is_acknowledged": True,
        "acknowledged_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.note:
        update_data["acknowledgement_note"] = body.note

    result = (
        supabase.table("alerts")
        .update(update_data)
        .eq("id", str(alert_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(404, "Alert not found")

    alert_data = result.data[0]
    room_id = alert_data.get("room_id")

    if room_id:
        # Check if there are any other unacknowledged alerts for this room
        active_res = (
            supabase.table("alerts")
            .select("id")
            .eq("room_id", str(room_id))
            .eq("is_acknowledged", False)
            .execute()
        )
        if not active_res.data:
            # No more active alerts for this room, update status to safe
            supabase.table("rooms").update({"status": "safe"}).eq("id", str(room_id)).execute()

    return alert_data


@router.post("/room-summary", response_model=RoomSummaryResponse)
async def room_summary(
    body: RoomSummaryRequest,
    user: OptionalUser = None,
):
    """Return per-room alert counts across all pages (no pagination).
    For basic users, filters to subscribed rooms only.
    """
    query = supabase.table("alerts").select("room_id, is_acknowledged")

    if body.severity:
        query = query.eq("severity", body.severity)

    if user is not None and user.role == "user":
        subscribed = get_subscribed_room_ids(user.id)
        if subscribed:
            query = query.in_("room_id", subscribed)
        else:
            return {"rooms": []}

    result = query.execute()
    rows = result.data or []

    # Single-pass grouping
    counts = defaultdict(lambda: {"total_alerts": 0, "unacknowledged_count": 0})
    room_ids_seen = set()

    for row in rows:
        rid = row.get("room_id")
        if not rid:
            continue
        is_ack = row.get("is_acknowledged", False)

        if body.acknowledged is None or is_ack == body.acknowledged:
            counts[rid]["total_alerts"] += 1

        if not is_ack:
            counts[rid]["unacknowledged_count"] += 1

        room_ids_seen.add(rid)

    if not room_ids_seen:
        return {"rooms": []}

    # Batch-lookup room names
    room_res = (
        supabase.table("rooms")
        .select("id, name")
        .in_("id", [str(r) for r in room_ids_seen])
        .execute()
    )
    room_name_map = {}
    for r in (room_res.data or []):
        room_name_map[r["id"]] = r.get("name", "Unknown Room")

    rooms = []
    for rid in room_ids_seen:
        total = counts[rid]["total_alerts"]
        if total == 0:
            continue
        rooms.append({
            "room_id": rid,
            "room_name": room_name_map.get(rid, "Unknown Room"),
            "total_alerts": total,
            "unacknowledged_count": counts[rid]["unacknowledged_count"],
        })

    # Sort by total_alerts descending
    rooms.sort(key=lambda x: x["total_alerts"], reverse=True)
    return {"rooms": rooms}


@router.post("/acknowledge-room/{room_id}", response_model=AcknowledgeRoomResponse)
async def acknowledge_room(
    room_id: UUID,
    user: CurrentUser,
):
    """Batch-acknowledge all unacknowledged alerts for a room.
    Basic users can only ack alerts in subscribed rooms.
    """
    if not _check_alert_access(user, str(room_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to acknowledge alerts in this room",
        )

    now_iso = datetime.now(timezone.utc).isoformat()

    # Count before updating
    count_res = (
        supabase.table("alerts")
        .select("id", count="exact")
        .eq("room_id", str(room_id))
        .eq("is_acknowledged", False)
        .execute()
    )
    count = count_res.count or 0

    if count == 0:
        return {
            "room_id": room_id,
            "acknowledged_count": 0,
            "message": "No unacknowledged alerts found for this room",
        }

    # Batch update
    supabase.table("alerts").update({
        "is_acknowledged": True,
        "acknowledged_at": now_iso,
    }).eq("room_id", str(room_id)).eq("is_acknowledged", False).execute()

    # Update room status to safe
    supabase.table("rooms").update({"status": "safe"}).eq("id", str(room_id)).execute()

    return {
        "room_id": room_id,
        "acknowledged_count": count,
        "message": f"{count} alerts acknowledged for room",
    }
