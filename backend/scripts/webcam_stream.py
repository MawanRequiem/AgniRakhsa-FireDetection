import argparse
import asyncio
import cv2
import base64
import json
import logging
from websockets.asyncio.client import connect

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def stream_webcam(camera_id: str, fps: float, server_url: str, source: str):
    ws_url = f"{server_url}/api/v1/camera/stream/{camera_id}"
    logger.info(f"Connecting to {ws_url}")
    
    # Open video source (local webcam integer or file path string)
    # Try converting to int first (for webcam index like 0, 1)
    try:
        video_source = int(source)
    except ValueError:
        video_source = source

    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        logger.error(f"Could not open video source: {source}")
        logger.error("Could not open webcam.")
        return

    # To maintain fixed FPS
    sleep_time = 1.0 / fps

    try:
        async with connect(ws_url) as websocket:
            logger.info("Connected to backend WebSocket! Streaming started...")
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    logger.warning("Failed to grab frame from webcam")
                    await asyncio.sleep(sleep_time)
                    continue
                
                # Resize to save bandwidth, model uses 416x416 anyway
                frame = cv2.resize(frame, (640, 480))
                
                # Encode frame to JPEG
                _, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                frame_b64 = base64.b64encode(buffer).decode('utf-8')
                
                # Send frame
                payload = {"frame": frame_b64}
                await websocket.send(json.dumps(payload))
                
                # Wait for ACK (non-blocking if we want strict FPS, but blocking is safer for sync)
                try:
                    # Only wait a short time for ack to not block camera
                    response = await asyncio.wait_for(websocket.recv(), timeout=0.5)
                    resp_data = json.loads(response)
                    if "error" in resp_data:
                        logger.error(f"Backend error: {resp_data['error']}")
                    else:
                        dets = resp_data.get("detections", 0)
                        if dets > 0:
                            logger.warning(f"🔥 Frame processed: {dets} detections!")
                        else:
                            logger.info("Frame processed: Clear")
                except asyncio.TimeoutError:
                    logger.warning("Timeout waiting for backend ACK, continuing...")
                except Exception as e:
                    logger.error(f"Error receiving ACK: {e}")
                    break

                await asyncio.sleep(sleep_time)
                
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        cap.release()
        logger.info("Webcam released.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stream PC webcam to AgniRakhsa backend for AI testing.")
    parser.add_argument("--camera-id", required=True, type=str, help="UUID of the camera registered in the system.")
    parser.add_argument("--fps", type=float, default=2.0, help="Frames per second to stream (default: 2.0).")
    parser.add_argument("--server", type=str, default="ws://localhost:8000", help="Backend WebSocket base URL.")
    parser.add_argument("--source", type=str, default="0", help="Video source (e.g., 0 for default webcam, 1 for external, or a video file path).")
    
    args = parser.parse_args()
    
    try:
        asyncio.run(stream_webcam(args.camera_id, args.fps, args.server, args.source))
    except KeyboardInterrupt:
        logger.info("Streaming stopped by user.")
