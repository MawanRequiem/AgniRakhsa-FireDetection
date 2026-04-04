"""Alert management API endpoints."""

from fastapi import APIRouter, HTTPException
from uuid import UUID
from datetime import datetime, timezone

from app.schemas.alert import AlertOut, AlertAcknowledge, AlertsResponse
from app.core.db import supabase

router = APIRouter(prefix="/alerts", tags=["alerts"])


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

    return result.data[0]
