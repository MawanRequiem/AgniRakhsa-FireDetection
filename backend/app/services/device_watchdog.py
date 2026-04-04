"""
Device Watchdog — Background task that detects stale devices and marks them offline.

Runs every WATCHDOG_INTERVAL_SECONDS, checks each device's `last_seen` timestamp,
and flips status to 'offline' if it exceeds DEVICE_TIMEOUT_SECONDS.
Broadcasts DEVICE_STATUS_CHANGE events via WebSocket so the dashboard updates in real-time.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from app.core.db import supabase

logger = logging.getLogger(__name__)

# How often the watchdog checks for stale devices
WATCHDOG_INTERVAL_SECONDS = 10

# If a device hasn't been heard from in this many seconds, mark it offline
DEVICE_TIMEOUT_SECONDS = 30


async def run_watchdog():
    """Infinite loop that checks for stale devices and marks them offline."""
    logger.info(
        f"Device watchdog started (interval={WATCHDOG_INTERVAL_SECONDS}s, timeout={DEVICE_TIMEOUT_SECONDS}s)"
    )
    
    while True:
        try:
            await _check_stale_devices()
        except Exception as e:
            logger.error(f"Watchdog error: {e}")
        
        await asyncio.sleep(WATCHDOG_INTERVAL_SECONDS)


async def _check_stale_devices():
    """Query all 'online' devices and mark any with stale last_seen as 'offline'."""
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=DEVICE_TIMEOUT_SECONDS)).isoformat()
    
    # Find devices that are currently online but haven't been seen since the cutoff
    res = (
        supabase.table("devices")
        .select("id, name, last_seen")
        .eq("status", "online")
        .lt("last_seen", cutoff)
        .execute()
    )
    
    stale_devices = res.data or []
    
    if not stale_devices:
        return
    
    # Also catch devices that are 'online' but have NULL last_seen
    null_res = (
        supabase.table("devices")
        .select("id, name, last_seen")
        .eq("status", "online")
        .is_("last_seen", "null")
        .execute()
    )
    stale_devices.extend(null_res.data or [])
    
    if not stale_devices:
        return
    
    logger.warning(f"Watchdog: {len(stale_devices)} device(s) went offline")
    
    # Mark each as offline and broadcast
    from app.api.ws_manager import manager
    
    for device in stale_devices:
        device_id = device["id"]
        
        supabase.table("devices").update({
            "status": "offline"
        }).eq("id", device_id).execute()
        
        logger.info(f"  → Device '{device.get('name', device_id)}' marked OFFLINE")
        
        # Broadcast to connected dashboard clients
        await manager.broadcast({
            "type": "DEVICE_STATUS_CHANGE",
            "data": {
                "device_id": device_id,
                "status": "offline",
                "name": device.get("name", ""),
            }
        })
