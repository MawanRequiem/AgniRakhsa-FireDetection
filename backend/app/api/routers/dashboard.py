"""Dashboard aggregation API endpoints."""

from fastapi import APIRouter
from uuid import UUID

from app.schemas.alert import AlertsResponse
from app.core.db import supabase
from app.api.deps import OptionalUser, get_subscribed_room_ids

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _filter_subscribed_rooms(user: OptionalUser) -> list[str] | None:
    """Returns subscribed room IDs for basic users, None for admins.
    Unauthenticated users get empty list (no access to any rooms).
    """
    if user is None:
        return []
    if user.role == "admin":
        return None
    return get_subscribed_room_ids(user.id)


@router.get("/summary")
async def get_dashboard_summary(user: OptionalUser = None):
    """Aggregated system overview for the main dashboard.
    For basic users, filters to subscribed rooms only.
    """
    subscribed_ids = _filter_subscribed_rooms(user)

    # ── Room query ──────────────────────────────────────────
    rooms = []
    if subscribed_ids is None:
        # Admin or unrestricted
        rooms_res = supabase.table("rooms").select("id, name, status").execute()
        rooms = rooms_res.data if hasattr(rooms_res, "data") else (rooms_res.get("data") if isinstance(rooms_res, dict) else []) or []
    elif subscribed_ids:
        # User has subscriptions
        rooms_res = supabase.table("rooms").select("id, name, status").in_("id", subscribed_ids).execute()
        rooms = rooms_res.data if hasattr(rooms_res, "data") else (rooms_res.get("data") if isinstance(rooms_res, dict) else []) or []
    # else: user is basic with no subscriptions, rooms remains []

    room_ids = [r["id"] for r in rooms]

    status_counts = {"safe": 0, "low": 0, "medium": 0, "high": 0, "critical": 0}
    for r in rooms:
        st = r.get("status") or "safe"
        if st in status_counts:
            status_counts[st] += 1

    # ── Active alerts ────────────────────────────────────────
    active_alerts = 0
    if subscribed_ids is None or subscribed_ids:
        alerts_query = (
            supabase.table("alerts")
            .select("id", count="exact")
            .eq("is_acknowledged", False)
        )
        if subscribed_ids is not None:
            alerts_query = alerts_query.in_("room_id", subscribed_ids)
        alerts_res = alerts_query.execute()
        active_alerts = alerts_res.count if hasattr(alerts_res, "count") else (alerts_res.get("count") if isinstance(alerts_res, dict) else 0) or 0

    # ── Device status counts ────────────────────────────────
    devices = []
    if room_ids:
        devices_res = supabase.table("devices").select("status, room_id").in_("room_id", room_ids).execute()
        devices = devices_res.data if hasattr(devices_res, "data") else (devices_res.get("data") if isinstance(devices_res, dict) else []) or []
    elif subscribed_ids is None:
        # Admin with zero rooms (edge case) or general query
        devices_res = supabase.table("devices").select("status, room_id").execute()
        devices = devices_res.data if hasattr(devices_res, "data") else (devices_res.get("data") if isinstance(devices_res, dict) else []) or []

    device_status = {"online": 0, "offline": 0, "error": 0}
    for d in devices:
        st = d.get("status") or "offline"
        if st in device_status:
            device_status[st] += 1

    # ── Recent critical/high fusion events ──────────────────
    recent_events = []
    if subscribed_ids is None or subscribed_ids:
        fusion_query = (
            supabase.table("fusion_results")
            .select("id, risk_level, fusion_score, created_at, room_id")
            .in_("risk_level", ["high", "critical"])
            .order("created_at", desc=True)
            .limit(5)
        )
        if subscribed_ids is not None:
            fusion_query = fusion_query.in_("room_id", subscribed_ids)
        fusion_res = fusion_query.execute()
        recent_events = fusion_res.data if hasattr(fusion_res, "data") else (fusion_res.get("data") if isinstance(fusion_res, dict) else []) or []

    return {
        "totalRooms": len(rooms),
        "totalDevices": len(devices),
        "onlineDevices": device_status.get("online", 0),
        "activeAlerts": active_alerts,
        "highRiskRooms": status_counts.get("high", 0) + status_counts.get("critical", 0),
        "room_status_counts": status_counts,
        "device_status_counts": device_status,
        "recent_critical_events": recent_events,
    }


@router.get("/alerts", response_model=AlertsResponse)
async def get_active_alerts(
    page: int = 1,
    page_size: int = 20,
    user: OptionalUser = None,
):
    """Paginated list of active (unacknowledged) alerts.
    For basic users, filters to subscribed rooms only.
    """
    subscribed_ids = _filter_subscribed_rooms(user)
    
    if subscribed_ids is not None and not subscribed_ids:
        # Basic user with no subscriptions has no alerts
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
        }

    offset = (page - 1) * page_size

    query = (
        supabase.table("alerts")
        .select("*", count="exact")
        .eq("is_acknowledged", False)
        .order("created_at", desc=True)
    )

    if subscribed_ids is not None:
        query = query.in_("room_id", subscribed_ids)

    res = query.range(offset, offset + page_size - 1).execute()

    return {
        "items": res.data if hasattr(res, "data") else (res.get("data", []) if isinstance(res, dict) else []),
        "total": res.count if hasattr(res, "count") else (res.get("count", 0) if isinstance(res, dict) else 0),
        "page": page,
        "page_size": page_size,
    }
