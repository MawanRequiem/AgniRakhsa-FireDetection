"""Alert management API endpoints."""

from fastapi import APIRouter, HTTPException
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

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=AlertsResponse)
@router.get("/", response_model=AlertsResponse)
async def list_alerts(
    page: int = 1,
    page_size: int = 30,
    severity: str | None = None,
    room_id: UUID | None = None,
    acknowledged: bool | None = None,
):
    """Paginated, filterable list of all system alerts."""
    offset = (page - 1) * page_size

    query = supabase.table("alerts").select("*", count="exact")

    if severity:
        query = query.eq("severity", severity)
    if room_id:
        query = query.eq("room_id", str(room_id))
    if acknowledged is not None:
        query = query.eq("is_acknowledged", acknowledged)

    result = (
        query
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    return {
        "items": result.data or [],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.patch("/{alert_id}/acknowledge", response_model=AlertOut)
async def acknowledge_alert(alert_id: UUID, body: AlertAcknowledge):
    """Mark an alert as acknowledged."""
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
async def room_summary(body: RoomSummaryRequest):
    """Return per-room alert counts across all pages (no pagination)."""
    query = supabase.table("alerts").select("room_id, is_acknowledged")

    if body.severity:
        query = query.eq("severity", body.severity)

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

        # total_alerts respects the acknowledged filter
        if body.acknowledged is None or is_ack == body.acknowledged:
            counts[rid]["total_alerts"] += 1

        # unacknowledged_count always counts ALL unacknowledged
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
async def acknowledge_room(room_id: UUID):
    """Batch-acknowledge all unacknowledged alerts for a room."""
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
