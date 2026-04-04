from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.api.ws_manager import manager
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/ws")
async def dashboard_websocket(websocket: WebSocket):
    """
    Real-time dashboard websocket endpoint.
    Clients connect to receive live telemetry and anomaly alerts.
    """
    await manager.connect(websocket)
    try:
        while True:
            # We don't necessarily expect data from dashboard clients right now,
            # but we need to receive to keep the cycle alive and detect disconnects.
            data = await websocket.receive_text()
            # Handle client pings if necessary
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket Error: {str(e)}")
        manager.disconnect(websocket)
