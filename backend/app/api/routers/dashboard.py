"""Dashboard aggregation API endpoints."""

from fastapi import APIRouter

from app.schemas.alert import AlertsResponse
from app.core.db import supabase

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_dashboard_summary():
    """Aggregated system overview for the main dashboard."""
    
    # 1. Get room statuses
    rooms_res = supabase.table("rooms").select("id, name, status").execute()
    rooms = rooms_res.data or []
    
    status_counts = {"safe": 0, "low": 0, "medium": 0, "high": 0, "critical": 0}
    for r in rooms:
        # Default to safe if status is None
        st = r.get("status") or "safe"
        if st in status_counts:
            status_counts[st] += 1
            
    # 2. Get active active alerts count
    alerts_res = (
        supabase.table("alerts")
        .select("id", count="exact")
        .eq("is_acknowledged", False)
        .execute()
    )
    active_alerts = alerts_res.count or 0
    
    # 3. Get device status counts
    devices_res = supabase.table("devices").select("status").execute()
    devices = devices_res.data or []
    
    device_status = {"online": 0, "offline": 0, "error": 0}
    for d in devices:
        st = d.get("status") or "offline"
        if st in device_status:
            device_status[st] += 1
            
    # 4. Recent critical/high fusion events
    fusion_res = (
        supabase.table("fusion_results")
        .select("id, risk_level, fusion_score, created_at, room_id")
        .in_("risk_level", ["high", "critical"])
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    
    return {
        "room_status_counts": status_counts,
        "active_alerts_count": active_alerts,
        "device_status_counts": device_status,
        "recent_critical_events": fusion_res.data or [],
        "total_rooms": len(rooms),
        "total_devices": len(devices),
    }


@router.get("/alerts", response_model=AlertsResponse)
async def get_active_alerts(page: int = 1, page_size: int = 20):
    """Paginated list of active (unacknowledged) alerts."""
    offset = (page - 1) * page_size
    
    res = (
        supabase.table("alerts")
        .select("*", count="exact")
        .eq("is_acknowledged", False)
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    
    return {
        "items": res.data or [],
        "total": res.count or 0,
        "page": page,
        "page_size": page_size,
    }
