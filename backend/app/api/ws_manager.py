import asyncio
import json
import logging
from typing import List, Dict, Any, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._telemetry_buffer: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()
        self._broadcast_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # Lazily start the background broadcast loop if not already running
        if self._broadcast_task is None or self._broadcast_task.done():
            self._broadcast_task = asyncio.create_task(self._throttled_broadcast_loop())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
            
        payload = json.dumps(message)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception:
                self.disconnect(connection)

    async def push_telemetry_update(self, device_id: str, readings: List[dict], timestamp: str):
        """
        Buffer a telemetry reading update in-memory to be batched and throttled.
        """
        async with self._lock:
            # Overwrite or aggregate. Since readings from the same node are sent together, 
            # overwriting with the latest values for the current 1.5s window is perfect.
            self._telemetry_buffer[device_id] = {
                "readings": readings,
                "timestamp": timestamp
            }

    async def _throttled_broadcast_loop(self):
        """
        Background loop that polls the telemetry buffer and broadcasts a single
        batched update message to all connected clients every 1.5 seconds.
        """
        logger.info("Starting throttled WebSocket telemetry broadcast loop...")
        try:
            while True:
                await asyncio.sleep(1.5)
                
                # Check if we have active clients and pending data
                if not self.active_connections:
                    # Clear buffer if no clients are listening to avoid memory growth
                    async with self._lock:
                        self._telemetry_buffer.clear()
                    continue
                
                batch_data = {}
                async with self._lock:
                    if self._telemetry_buffer:
                        batch_data = dict(self._telemetry_buffer)
                        self._telemetry_buffer.clear()
                
                if batch_data:
                    await self.broadcast({
                        "type": "SENSOR_BATCH_UPDATE",
                        "data": {
                            "devices": batch_data
                        }
                    })
        except asyncio.CancelledError:
            logger.info("Throttled WebSocket telemetry broadcast loop cancelled.")
        except Exception as e:
            logger.error(f"Error in throttled WebSocket broadcast loop: {e}", exc_info=True)
            # Backoff delay to prevent rapid crash-restart loop if the error is persistent
            await asyncio.sleep(2)
            self._broadcast_task = asyncio.create_task(self._throttled_broadcast_loop())

manager = ConnectionManager()
