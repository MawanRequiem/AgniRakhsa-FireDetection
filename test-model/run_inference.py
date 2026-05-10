"""
🔥 AgniRakhsa – Standalone YOLO Fire Detection Inference Tool
=============================================================

Run fire/smoke detection directly without starting the backend server.
Supports: single image, folder of images, webcam feed, and video files.

Usage:
    # Single image
    python run_inference.py --source path/to/image.jpg

    # Folder of images
    python run_inference.py --source path/to/folder/

    # Webcam (default camera 0)
    python run_inference.py --source webcam

    # Use a specific camera index (e.g. DroidCam at index 1)
    python run_inference.py --source webcam --cam 1

    # Use DroidCam via IP address
    python run_inference.py --source webcam --cam http://192.168.1.100:4747/video

    # List available cameras on your system
    python run_inference.py --list-cams

    # Video file
    python run_inference.py --source path/to/video.mp4

    # Adjust confidence threshold
    python run_inference.py --source image.jpg --conf 0.5

    # Don't show the window (headless)
    python run_inference.py --source image.jpg --no-show

    # Save annotated results to a custom folder
    python run_inference.py --source image.jpg --output results/
"""

import argparse
import sys
import os
import time
from pathlib import Path

# Fix Windows console encoding for emoji/unicode output
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ─── Resolve model path relative to this script ─────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DEFAULT_MODEL_PATH = PROJECT_ROOT / "backend" / "app" / "ai" / "yolo" / "fire_detection_model.pt"
DEFAULT_INPUT_SIZE = 416
DEFAULT_CONF = 0.25

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv"}


def parse_args():
    parser = argparse.ArgumentParser(
        description="🔥 AgniRakhsa – YOLO Fire Detection Inference",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--source",
        type=str,
        required=True,
        help="Input source: image path, folder path, video path, or 'webcam'",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=str(DEFAULT_MODEL_PATH),
        help=f"Path to YOLO .pt model file (default: {DEFAULT_MODEL_PATH})",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=DEFAULT_CONF,
        help=f"Confidence threshold (default: {DEFAULT_CONF})",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=DEFAULT_INPUT_SIZE,
        help=f"Inference input size (default: {DEFAULT_INPUT_SIZE})",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(SCRIPT_DIR / "output"),
        help="Directory to save annotated results (default: test-model/output/)",
    )
    parser.add_argument(
        "--no-show",
        action="store_true",
        help="Don't display the results window (headless mode)",
    )
    parser.add_argument(
        "--save",
        action="store_true",
        default=True,
        help="Save annotated images to the output directory (default: True)",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Don't save annotated images",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=0,
        help="Target FPS limit for webcam/video (0 = unlimited, e.g. --fps 10)",
    )
    parser.add_argument(
        "--cam",
        type=str,
        default="0",
        help=(
            "Camera source for webcam mode. Can be:\n"
            "  - Integer index: 0 (built-in), 1 (DroidCam), etc.\n"
            "  - DroidCam IP URL: http://192.168.1.100:4747/video\n"
            "  (default: 0)"
        ),
    )
    parser.add_argument(
        "--list-cams",
        action="store_true",
        help="List available camera devices and exit",
    )
    parser.add_argument(
        "--resolution",
        type=str,
        default=None,
        help=(
            "Webcam capture resolution as WIDTHxHEIGHT (e.g. 1280x720, 1920x1080).\n"
            "Common options: 640x480, 1280x720, 1920x1080.\n"
            "If not set, uses the camera's default resolution."
        ),
    )
    return parser.parse_args()


def load_model(model_path: str, conf: float):
    """Load the YOLO model and return it."""
    from ultralytics import YOLO

    path = Path(model_path)
    if not path.exists():
        print(f"❌ Model file not found: {path}")
        print(f"   Expected location: {DEFAULT_MODEL_PATH}")
        sys.exit(1)

    print(f"📦 Loading model: {path.name}")
    model = YOLO(str(path))
    print(f"✅ Model loaded — Classes: {model.names}")
    print(f"   Confidence threshold: {conf}")
    return model


def draw_detections(image, results, model):
    """Draw bounding boxes and labels on the image using OpenCV."""
    import cv2
    import numpy as np

    annotated = image.copy()
    det_count = 0

    if results and len(results) > 0:
        result = results[0]
        if result.boxes is not None and len(result.boxes) > 0:
            for box in result.boxes:
                coords = box.xyxy[0].tolist()
                x1, y1, x2, y2 = int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3])
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                class_name = model.names.get(class_id, f"class_{class_id}")

                # Color coding: fire = red/orange, smoke = gray, else = green
                lower_name = class_name.lower()
                if "fire" in lower_name or "flame" in lower_name:
                    color = (0, 69, 255)     # Orange-red (BGR)
                    text_bg = (0, 40, 200)
                elif "smoke" in lower_name:
                    color = (180, 180, 180)  # Gray
                    text_bg = (120, 120, 120)
                else:
                    color = (0, 255, 120)    # Green
                    text_bg = (0, 180, 80)

                # Draw bounding box
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

                # Draw label with background
                label = f"{class_name} {confidence:.2f}"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.6
                thickness = 2
                (tw, th), _ = cv2.getTextSize(label, font, font_scale, thickness)
                cv2.rectangle(annotated, (x1, y1 - th - 10), (x1 + tw + 6, y1), text_bg, -1)
                cv2.putText(annotated, label, (x1 + 3, y1 - 5), font, font_scale, (255, 255, 255), thickness)

                det_count += 1

    return annotated, det_count


def print_result_summary(results, model, source_name: str, elapsed_ms: int):
    """Print a formatted summary of detection results."""
    det_count = 0
    details = []

    if results and len(results) > 0:
        result = results[0]
        if result.boxes is not None and len(result.boxes) > 0:
            for box in result.boxes:
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                class_name = model.names.get(class_id, f"class_{class_id}")
                details.append((class_name, confidence))
                det_count += 1

    status = "🔥 DETECTED" if det_count > 0 else "✅ No detection"
    print(f"\n{'─' * 60}")
    print(f"  📷 Source   : {source_name}")
    print(f"  ⏱  Time     : {elapsed_ms} ms")
    print(f"  🎯 Status   : {status}")
    print(f"  📊 Count    : {det_count} object(s)")

    for i, (cls, conf) in enumerate(details, 1):
        print(f"      [{i}] {cls}: {conf:.4f}")
    print(f"{'─' * 60}")


def infer_image(model, image_path: Path, args):
    """Run inference on a single image file."""
    import cv2

    img = cv2.imread(str(image_path))
    if img is None:
        print(f"⚠️  Could not read image: {image_path}")
        return

    start = time.perf_counter()
    results = model.predict(img, conf=args.conf, imgsz=args.imgsz, verbose=False)
    elapsed_ms = int((time.perf_counter() - start) * 1000)

    print_result_summary(results, model, image_path.name, elapsed_ms)

    annotated, det_count = draw_detections(img, results, model)

    if not args.no_save:
        out_dir = Path(args.output)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"det_{image_path.name}"
        cv2.imwrite(str(out_path), annotated)
        print(f"  💾 Saved    : {out_path}")

    if not args.no_show:
        window_name = f"AgniRakhsa - {image_path.name}"
        cv2.imshow(window_name, annotated)
        print(f"\n  Press any key to continue...")
        cv2.waitKey(0)
        cv2.destroyAllWindows()


def infer_folder(model, folder_path: Path, args):
    """Run inference on all images in a folder."""
    images = sorted(
        f for f in folder_path.iterdir()
        if f.suffix.lower() in IMAGE_EXTENSIONS
    )

    if not images:
        print(f"⚠️  No images found in: {folder_path}")
        return

    print(f"\n📁 Found {len(images)} image(s) in {folder_path}\n")

    total_det = 0
    total_time = 0

    for img_path in images:
        import cv2

        img = cv2.imread(str(img_path))
        if img is None:
            print(f"⚠️  Skipping unreadable: {img_path.name}")
            continue

        start = time.perf_counter()
        results = model.predict(img, conf=args.conf, imgsz=args.imgsz, verbose=False)
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        total_time += elapsed_ms

        print_result_summary(results, model, img_path.name, elapsed_ms)

        annotated, det_count = draw_detections(img, results, model)
        total_det += det_count

        if not args.no_save:
            out_dir = Path(args.output)
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"det_{img_path.name}"
            cv2.imwrite(str(out_path), annotated)
            print(f"  💾 Saved    : {out_path}")

    print(f"\n{'═' * 60}")
    print(f"  📊 BATCH SUMMARY")
    print(f"     Images processed : {len(images)}")
    print(f"     Total detections : {total_det}")
    print(f"     Total time       : {total_time} ms")
    print(f"     Avg per image    : {total_time // max(len(images), 1)} ms")
    print(f"{'═' * 60}\n")


def list_cameras():
    """Enumerate available camera devices."""
    import cv2

    print("\n🔍 Scanning for available cameras...\n")
    found = 0
    for i in range(10):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if cap.isOpened():
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            print(f"  ✅ Camera {i}: {w}x{h} @ {fps:.0f} FPS")
            found += 1
            cap.release()
        else:
            cap.release()

    if found == 0:
        print("  ❌ No cameras found.")
    else:
        print(f"\n  📷 Found {found} camera(s).")
        print(f"  💡 Use --cam <index> to select one (e.g. --cam 1 for DroidCam)")
    print()


def _parse_cam_source(cam_arg: str):
    """Parse the --cam argument into a VideoCapture-compatible source."""
    # If it looks like a URL (DroidCam IP, RTSP, etc.), use as-is
    if cam_arg.startswith("http://") or cam_arg.startswith("https://") or cam_arg.startswith("rtsp://"):
        return cam_arg
    # Otherwise treat as integer camera index
    try:
        return int(cam_arg)
    except ValueError:
        print(f"⚠️  Invalid --cam value: '{cam_arg}'. Using default camera 0.")
        return 0


def infer_webcam(model, args):
    """Run live inference using webcam feed."""
    import cv2

    target_fps = args.fps
    frame_interval = 1.0 / target_fps if target_fps > 0 else 0

    cam_source = _parse_cam_source(args.cam)
    source_label = f"IP stream ({cam_source})" if isinstance(cam_source, str) else f"camera {cam_source}"
    fps_info = f" (limited to {target_fps} FPS)" if target_fps > 0 else " (unlimited FPS)"
    print(f"\n📹 Starting {source_label}{fps_info} — press 'q' to quit...\n")

    # Try CAP_DSHOW backend on Windows for better device control
    if isinstance(cam_source, int) and sys.platform == "win32":
        cap = cv2.VideoCapture(cam_source, cv2.CAP_DSHOW)
    else:
        cap = cv2.VideoCapture(cam_source)

    if not cap.isOpened():
        print("❌ Cannot open webcam")
        sys.exit(1)

    # Parse target resolution
    target_w, target_h = None, None
    force_resize = False
    if args.resolution:
        try:
            tw, th = args.resolution.lower().split("x")
            target_w, target_h = int(tw), int(th)
            # Try setting via OpenCV first
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, target_w)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, target_h)
        except ValueError:
            print(f"⚠️  Invalid --resolution format: '{args.resolution}'. Use WIDTHxHEIGHT (e.g. 1280x720)")

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Check if camera honored the resolution request
    if target_w and target_h and (actual_w != target_w or actual_h != target_h):
        force_resize = True
        print(f"   Camera native : {actual_w}x{actual_h}")
        print(f"   Resizing to   : {target_w}x{target_h} (forced)")
    else:
        print(f"   Resolution: {actual_w}x{actual_h}")

    frame_count = 0
    total_time = 0
    last_frame_time = 0.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("⚠️  Failed to grab frame")
                break

            # Force resize if camera didn't honor resolution request
            if force_resize:
                frame = cv2.resize(frame, (target_w, target_h))

            # FPS limiter — skip frame if too early
            now = time.perf_counter()
            if frame_interval > 0 and (now - last_frame_time) < frame_interval:
                # Still show the raw frame so window doesn't freeze
                if not args.no_show:
                    cv2.imshow("AgniRakhsa - Live Detection", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                continue
            last_frame_time = now

            start = time.perf_counter()
            results = model.predict(frame, conf=args.conf, imgsz=args.imgsz, verbose=False)
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            total_time += elapsed_ms
            frame_count += 1

            annotated, det_count = draw_detections(frame, results, model)

            # Draw FPS counter
            actual_fps = 1000 / max(elapsed_ms, 1)
            fps_label = f"Target: {target_fps}" if target_fps > 0 else "Unlimited"
            fps_text = f"FPS: {actual_fps:.1f} ({fps_label}) | Det: {det_count}"
            cv2.putText(annotated, fps_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

            if not args.no_show:
                cv2.imshow("AgniRakhsa - Live Detection", annotated)

            if det_count > 0:
                # Print detection in console for live feedback
                result = results[0]
                for box in result.boxes:
                    conf = float(box.conf[0])
                    cls = model.names.get(int(box.cls[0]), "?")
                    print(f"  🔥 Frame {frame_count}: {cls} ({conf:.2f})", end="\r")

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()

    avg_ms = total_time // max(frame_count, 1)
    print(f"\n\n{'═' * 60}")
    print(f"  📊 WEBCAM SESSION SUMMARY")
    print(f"     FPS limit         : {target_fps if target_fps > 0 else 'Unlimited'}")
    print(f"     Frames processed  : {frame_count}")
    print(f"     Total time        : {total_time} ms")
    print(f"     Avg per frame     : {avg_ms} ms ({1000 // max(avg_ms, 1)} FPS)")
    print(f"{'═' * 60}\n")


def infer_video(model, video_path: Path, args):
    """Run inference on a video file."""
    import cv2

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"❌ Cannot open video: {video_path}")
        sys.exit(1)

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps_orig = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"\n🎬 Video: {video_path.name}")
    print(f"   Resolution: {width}x{height} | FPS: {fps_orig:.1f} | Frames: {total_frames}")

    # Setup video writer for saving output
    out_writer = None
    if not args.no_save:
        out_dir = Path(args.output)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"det_{video_path.stem}.mp4"
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out_writer = cv2.VideoWriter(str(out_path), fourcc, fps_orig, (width, height))
        print(f"   Saving to: {out_path}")

    print(f"\n   Processing... (press 'q' to stop)\n")

    frame_count = 0
    total_time = 0
    total_det = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            start = time.perf_counter()
            results = model.predict(frame, conf=args.conf, imgsz=args.imgsz, verbose=False)
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            total_time += elapsed_ms
            frame_count += 1

            annotated, det_count = draw_detections(frame, results, model)
            total_det += det_count

            # Draw FPS + progress
            fps = 1000 / max(elapsed_ms, 1)
            progress = f"[{frame_count}/{total_frames}]" if total_frames > 0 else f"[{frame_count}]"
            info_text = f"{progress} FPS: {fps:.1f} | Det: {det_count}"
            cv2.putText(annotated, info_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

            if out_writer:
                out_writer.write(annotated)

            if not args.no_show:
                cv2.imshow("AgniRakhsa - Video Detection", annotated)

            # Progress in console
            pct = (frame_count / max(total_frames, 1)) * 100
            print(f"   Progress: {pct:.1f}% ({frame_count}/{total_frames}) — {det_count} det(s)", end="\r")

            if cv2.waitKey(1) & 0xFF == ord("q"):
                print("\n   ⏹  Stopped by user.")
                break
    except KeyboardInterrupt:
        print("\n   ⏹  Interrupted.")
    finally:
        cap.release()
        if out_writer:
            out_writer.release()
        cv2.destroyAllWindows()

    avg_ms = total_time // max(frame_count, 1)
    print(f"\n\n{'═' * 60}")
    print(f"  📊 VIDEO SUMMARY")
    print(f"     File              : {video_path.name}")
    print(f"     Frames processed  : {frame_count}")
    print(f"     Total detections  : {total_det}")
    print(f"     Total time        : {total_time} ms")
    print(f"     Avg per frame     : {avg_ms} ms ({1000 // max(avg_ms, 1)} FPS)")
    print(f"{'═' * 60}\n")


def main():
    print(r"""
    ╔══════════════════════════════════════════════════════╗
    ║     🔥 AgniRakhsa – YOLO Fire Detection Tester 🔥    ║
    ║               Standalone Inference Tool               ║
    ╚══════════════════════════════════════════════════════╝
    """)

    args = parse_args()
    save = not args.no_save
    args.no_save = not save  # normalize

    model = load_model(args.model, args.conf)

    # ── List cameras and exit ────────────────────────────
    if args.list_cams:
        list_cameras()
        return

    source = args.source.strip()

    # ── Webcam ───────────────────────────────────────────
    if source.lower() == "webcam":
        infer_webcam(model, args)
        return

    source_path = Path(source)
    if not source_path.exists():
        print(f"❌ Source not found: {source_path}")
        sys.exit(1)

    # ── Single image ─────────────────────────────────────
    if source_path.is_file() and source_path.suffix.lower() in IMAGE_EXTENSIONS:
        infer_image(model, source_path, args)
        return

    # ── Video file ───────────────────────────────────────
    if source_path.is_file() and source_path.suffix.lower() in VIDEO_EXTENSIONS:
        infer_video(model, source_path, args)
        return

    # ── Folder of images ─────────────────────────────────
    if source_path.is_dir():
        infer_folder(model, source_path, args)
        return

    print(f"❌ Unsupported source: {source}")
    print(f"   Supported image formats: {IMAGE_EXTENSIONS}")
    print(f"   Supported video formats: {VIDEO_EXTENSIONS}")
    print(f"   Or use 'webcam' for live camera feed")
    sys.exit(1)


if __name__ == "__main__":
    main()
