"""
AgniRakhsa — Production RTSP / Webcam Stream Client

Streams frames from an RTSP camera (or local webcam) to the backend
WebSocket endpoint for real-time YOLO fire-detection inference.

Production features:
  • Threaded frame capture — network I/O doesn't block the send loop
  • Auto-reconnect with exponential backoff (RTSP drops are expected)
  • RTSP-specific OpenCV tuning (TCP transport, reduced buffer)
  • Stream health metrics and watchdog
  • Graceful shutdown on SIGINT / Ctrl-C

Usage (RTSP):
  python webcam_stream.py \
    --camera-id <UUID> \
    --source "rtsp://admin:test@192.168.1.6:8554/Streaming/Channels/101" \
    --fps 2

Usage (local webcam):
  python webcam_stream.py --camera-id <UUID> --source 0 --fps 5
"""

import argparse
import asyncio
import base64
import json
import logging
import os
import signal
import sys
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import cv2
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

# ─── Logging ────────────────────────────────────────────────────────────────

LOG_FORMAT = "%(asctime)s │ %(levelname)-7s │ %(name)s │ %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger("agniraksha.stream")


# ─── Constants ──────────────────────────────────────────────────────────────

class StreamType(Enum):
    LOCAL = "local"
    RTSP = "rtsp"
    FILE = "file"


# Reconnection
MAX_BACKOFF_SECONDS = 30
INITIAL_BACKOFF_SECONDS = 1.0

# Stream health
HEALTH_LOG_INTERVAL = 30          # seconds between health reports
FRAME_TIMEOUT_SECONDS = 10        # consider stream dead if no frame in N seconds
WS_CONNECT_TIMEOUT = 10           # seconds to wait for WS handshake


# ─── Stream Health Tracker ──────────────────────────────────────────────────

@dataclass
class StreamHealth:
    """Tracks real-time health metrics for the capture pipeline."""
    frames_captured: int = 0
    frames_sent: int = 0
    frames_dropped: int = 0
    detections_total: int = 0
    reconnect_count: int = 0
    last_frame_time: float = field(default_factory=time.time)
    start_time: float = field(default_factory=time.time)

    @property
    def uptime_seconds(self) -> float:
        return time.time() - self.start_time

    @property
    def fps_actual(self) -> float:
        elapsed = self.uptime_seconds
        return self.frames_sent / elapsed if elapsed > 0 else 0.0

    def report(self) -> str:
        return (
            f"uptime={self.uptime_seconds:.0f}s | "
            f"captured={self.frames_captured} | "
            f"sent={self.frames_sent} | "
            f"dropped={self.frames_dropped} | "
            f"detections={self.detections_total} | "
            f"reconnects={self.reconnect_count} | "
            f"avg_fps={self.fps_actual:.2f}"
        )


# ─── Threaded Frame Capture ────────────────────────────────────────────────

class FrameGrabber:
    """
    Runs OpenCV VideoCapture in a background thread so that the async
    send-loop is never blocked by network I/O (critical for RTSP).

    Always holds only the *latest* frame — stale frames are discarded.
    """

    def __init__(self, source: str, stream_type: StreamType):
        self._source = source
        self._stream_type = stream_type
        self._cap: Optional[cv2.VideoCapture] = None
        self._frame: Optional[object] = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._connected = threading.Event()

    # ── Public API ──────────────────────────────────────────

    def start(self) -> bool:
        """Open the video source and start the capture thread."""
        self._cap = self._open_capture()
        if self._cap is None or not self._cap.isOpened():
            return False

        self._running = True
        self._connected.set()
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        logger.info(f"Frame grabber started [{self._stream_type.value}]")
        return True

    def stop(self):
        """Release resources and join the capture thread."""
        self._running = False
        self._connected.clear()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)
        if self._cap:
            self._cap.release()
            self._cap = None
        logger.info("Frame grabber stopped")

    def get_frame(self):
        """Return the latest frame (or None if nothing captured yet)."""
        with self._lock:
            return self._frame

    @property
    def is_alive(self) -> bool:
        return self._running and self._connected.is_set()

    # ── Private ─────────────────────────────────────────────

    def _open_capture(self) -> Optional[cv2.VideoCapture]:
        """Create and configure the VideoCapture with RTSP-specific tuning."""
        src = self._source

        if self._stream_type == StreamType.LOCAL:
            cap = cv2.VideoCapture(int(src))
        elif self._stream_type == StreamType.RTSP:
            # Force FFMPEG backend + TCP for reliable RTSP
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
            cap = cv2.VideoCapture(src, cv2.CAP_FFMPEG)
            # Minimize internal buffer to always get latest frame
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        else:
            # File or other source
            cap = cv2.VideoCapture(src)

        if not cap.isOpened():
            logger.error(f"Failed to open source: {src}")
            return None

        # Log native stream properties
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        native_fps = cap.get(cv2.CAP_PROP_FPS)
        logger.info(f"Source opened: {w}x{h} @ {native_fps:.1f}fps (native)")
        return cap

    def _capture_loop(self):
        """Continuously grab frames in a background thread."""
        consecutive_failures = 0
        max_failures = 50  # ≈5 seconds at 10ms/iter before declaring dead

        while self._running:
            if self._cap is None or not self._cap.isOpened():
                self._connected.clear()
                break

            ret, frame = self._cap.read()
            if not ret:
                consecutive_failures += 1
                if consecutive_failures > max_failures:
                    logger.warning("Too many consecutive read failures — stream dead")
                    self._connected.clear()
                    break
                time.sleep(0.01)
                continue

            consecutive_failures = 0
            with self._lock:
                self._frame = frame

        self._running = False


# ─── Detect source type ────────────────────────────────────────────────────

def classify_source(source: str) -> StreamType:
    """Classify the video source as local webcam, RTSP, or file."""
    try:
        int(source)
        return StreamType.LOCAL
    except ValueError:
        pass

    lower = source.lower()
    if lower.startswith("rtsp://") or lower.startswith("rtsps://"):
        return StreamType.RTSP
    return StreamType.FILE


# ─── Main streaming coroutine ──────────────────────────────────────────────

async def stream_camera(
    camera_id: str,
    fps: float,
    server_url: str,
    source: str,
    resolution: tuple[int, int] = (640, 480),
    jpeg_quality: int = 80,
):
    """
    Main loop: capture frames → encode → send over WS → receive ACK.

    Implements auto-reconnect for both the RTSP source and the WebSocket
    connection independently.
    """
    ws_url = f"{server_url}/api/v1/camera/stream/{camera_id}"
    stream_type = classify_source(source)
    health = StreamHealth()
    sleep_time = 1.0 / fps

    logger.info("═" * 60)
    logger.info(f"  AgniRakhsa Stream Client")
    logger.info(f"  Camera ID  : {camera_id}")
    logger.info(f"  Source     : {source} ({stream_type.value})")
    logger.info(f"  Target FPS : {fps}")
    logger.info(f"  Resolution : {resolution[0]}x{resolution[1]}")
    logger.info(f"  Backend WS : {ws_url}")
    logger.info("═" * 60)

    backoff = INITIAL_BACKOFF_SECONDS

    while True:
        # ── 1. Start frame grabber ──────────────────────────
        grabber = FrameGrabber(source, stream_type)
        if not grabber.start():
            logger.error(f"Cannot open source, retrying in {backoff:.1f}s ...")
            health.reconnect_count += 1
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
            continue

        backoff = INITIAL_BACKOFF_SECONDS  # reset on successful open

        # ── 2. Connect WebSocket ────────────────────────────
        try:
            logger.info(f"Connecting to {ws_url} ...")
            websocket = await asyncio.wait_for(
                connect(ws_url), timeout=WS_CONNECT_TIMEOUT
            )
        except Exception as e:
            logger.error(f"WebSocket connect failed: {e}")
            grabber.stop()
            health.reconnect_count += 1
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
            continue

        logger.info("🟢 Connected — streaming live")
        last_health_log = time.time()

        # ── 3. Frame send loop ──────────────────────────────
        try:
            async with websocket:
                while True:
                    # Check grabber is alive
                    if not grabber.is_alive:
                        logger.warning("Frame grabber died — reconnecting source")
                        break

                    frame = grabber.get_frame()
                    if frame is None:
                        await asyncio.sleep(0.05)
                        continue

                    health.frames_captured += 1
                    health.last_frame_time = time.time()

                    # Resize for bandwidth efficiency
                    frame_resized = cv2.resize(frame, resolution)

                    # Encode to JPEG
                    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality]
                    ok, buffer = cv2.imencode(".jpg", frame_resized, encode_params)
                    if not ok:
                        health.frames_dropped += 1
                        continue

                    frame_b64 = base64.b64encode(buffer).decode("utf-8")

                    # Send frame payload
                    payload = json.dumps({"frame": frame_b64})
                    await websocket.send(payload)
                    health.frames_sent += 1

                    # Wait for ACK
                    try:
                        response = await asyncio.wait_for(
                            websocket.recv(), timeout=2.0
                        )
                        resp_data = json.loads(response)
                        if "error" in resp_data:
                            logger.error(f"Backend error: {resp_data['error']}")
                        else:
                            dets = resp_data.get("detections", 0)
                            health.detections_total += dets
                            if dets > 0:
                                logger.warning(
                                    f"🔥 FIRE DETECTED — {dets} detection(s) in frame #{health.frames_sent}"
                                )
                    except asyncio.TimeoutError:
                        logger.debug("ACK timeout (backend busy), continuing")
                    except json.JSONDecodeError:
                        logger.warning("Invalid JSON in ACK response")

                    # Periodic health report
                    now = time.time()
                    if now - last_health_log >= HEALTH_LOG_INTERVAL:
                        logger.info(f"📊 Health: {health.report()}")
                        last_health_log = now

                    # Throttle to target FPS
                    await asyncio.sleep(sleep_time)

        except ConnectionClosed as e:
            logger.warning(f"WebSocket closed: code={e.code} reason={e.reason}")
        except Exception as e:
            logger.error(f"Stream error: {e}")
        finally:
            grabber.stop()
            health.reconnect_count += 1
            logger.info(f"📊 Session stats: {health.report()}")
            logger.info(f"Reconnecting in {backoff:.1f}s ...")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)


# ─── CLI ────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="AgniRakhsa — Stream RTSP / webcam to backend for AI inference.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Stream from RTSP camera
  python webcam_stream.py \\
    --camera-id abc123-uuid \\
    --source "rtsp://admin:test@192.168.1.6:8554/Streaming/Channels/101"

  # Stream from local webcam
  python webcam_stream.py --camera-id abc123-uuid --source 0

  # Custom settings
  python webcam_stream.py \\
    --camera-id abc123-uuid \\
    --source "rtsp://admin:test@192.168.1.6:8554/Streaming/Channels/101" \\
    --fps 5 --resolution 1280x720 --quality 90
        """,
    )

    parser.add_argument(
        "--camera-id",
        required=True,
        type=str,
        help="UUID of the camera registered in the AgniRakhsa system.",
    )
    parser.add_argument(
        "--source",
        type=str,
        default="0",
        help=(
            "Video source: integer for local webcam (0, 1), "
            "RTSP URL, or path to video file. "
            'Default: "0" (primary webcam).'
        ),
    )
    parser.add_argument(
        "--fps",
        type=float,
        default=2.0,
        help="Target frames-per-second to stream (default: 2.0).",
    )
    parser.add_argument(
        "--server",
        type=str,
        default="ws://localhost:8000",
        help="Backend WebSocket base URL (default: ws://localhost:8000).",
    )
    parser.add_argument(
        "--resolution",
        type=str,
        default="640x480",
        help="Resize frames to WxH before sending (default: 640x480).",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=80,
        choices=range(10, 101),
        metavar="[10-100]",
        help="JPEG quality 10-100 (default: 80).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable DEBUG-level logging.",
    )

    return parser


def parse_resolution(res_str: str) -> tuple[int, int]:
    """Parse '640x480' into (640, 480)."""
    parts = res_str.lower().split("x")
    if len(parts) != 2:
        raise argparse.ArgumentTypeError(
            f"Invalid resolution format: {res_str}. Use WxH (e.g. 640x480)."
        )
    return int(parts[0]), int(parts[1])


# ─── Entry point ────────────────────────────────────────────────────────────

def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    resolution = parse_resolution(args.resolution)

    # Mask credentials in log output
    display_source = args.source
    if "://" in display_source and "@" in display_source:
        # rtsp://admin:test@host → rtsp://***:***@host
        proto, rest = display_source.split("://", 1)
        if "@" in rest:
            creds, host = rest.rsplit("@", 1)
            display_source = f"{proto}://***:***@{host}"

    logger.info(f"Starting stream client → source={display_source}")

    try:
        asyncio.run(
            stream_camera(
                camera_id=args.camera_id,
                fps=args.fps,
                server_url=args.server,
                source=args.source,
                resolution=resolution,
                jpeg_quality=args.quality,
            )
        )
    except KeyboardInterrupt:
        logger.info("⏹ Streaming stopped by user (Ctrl-C)")
        sys.exit(0)


if __name__ == "__main__":
    main()
