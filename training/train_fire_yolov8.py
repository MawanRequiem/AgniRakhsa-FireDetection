"""
AgniRakhsa — YOLOv8 Fire Detection Model Training Script (Kaggle)
=================================================================

This script trains a YOLOv8 model for fire/smoke detection with
production-grade hyperparameters, augmentation, and evaluation.

Usage (Kaggle Notebook):
  1. Upload your fire detection dataset
  2. Create/verify data.yaml points to correct paths
  3. Run this script

Hardware targets:
  - Kaggle T4 (16 GB VRAM)  → batch auto-scaled
  - Kaggle P100 (16 GB VRAM) → batch auto-scaled
  - Dual T4 supported via multi-GPU

Author: AgniRakhsa Team
"""

from ultralytics import YOLO
import torch
import os
import yaml

# ──────────────────────────────────────────────
# 1. ENVIRONMENT DIAGNOSTICS
# ──────────────────────────────────────────────
print("=" * 60)
print("ENVIRONMENT CHECK")
print("=" * 60)
print(f"  PyTorch version : {torch.__version__}")
print(f"  CUDA available  : {torch.cuda.is_available()}")

n_gpu = torch.cuda.device_count()
if n_gpu > 0:
    for i in range(n_gpu):
        props = torch.cuda.get_device_properties(i)
        vram_gb = props.total_mem / (1024 ** 3)
        print(f"  GPU {i}           : {props.name} ({vram_gb:.1f} GB)")
    device = ",".join(str(i) for i in range(n_gpu))
else:
    print("  GPU             : None (using CPU — training will be SLOW)")
    device = "cpu"
print(f"  Device string   : {device}")
print("=" * 60)


# ──────────────────────────────────────────────
# 2. DATASET VERIFICATION
# ──────────────────────────────────────────────
data_path = "/kaggle/working/data.yaml"
assert os.path.exists(data_path), f"data.yaml not found at {data_path}!"

with open(data_path, "r") as f:
    data_cfg = yaml.safe_load(f)

print("\nDATASET CONFIG:")
print(f"  Classes : {data_cfg.get('names', 'NOT SET')}")
print(f"  NC      : {data_cfg.get('nc', 'NOT SET')}")
print(f"  Train   : {data_cfg.get('train', 'NOT SET')}")
print(f"  Val     : {data_cfg.get('val', 'NOT SET')}")
print(f"  Test    : {data_cfg.get('test', 'NOT SET')}")

nc = data_cfg.get("nc", 2)  # Typically: 0=fire, 1=smoke


# ──────────────────────────────────────────────
# 3. MODEL SELECTION
# ──────────────────────────────────────────────
# YOLOv8n: Best speed/accuracy tradeoff for edge deployment (ESP32-CAM / webcam)
# If you have more VRAM and want higher accuracy, try:
#   - "yolov8s.pt" (small)  → better accuracy, ~2x slower
#   - "yolov8m.pt" (medium) → significantly better, ~4x slower
#
# For fire detection specifically, 'n' is acceptable because:
#   - Fire/smoke are visually distinct (high contrast)
#   - We fuse with sensor data (compensates for visual FP/FN)
#   - Inference must be fast for real-time streaming

MODEL_VARIANT = "yolov8n.pt"
model = YOLO(MODEL_VARIANT)
print(f"\nModel loaded: {MODEL_VARIANT}")


# ──────────────────────────────────────────────
# 4. TRAINING CONFIGURATION
# ──────────────────────────────────────────────
#
# KEY TUNING DECISIONS (explained):
#
# [imgsz=640]
#   Your current script uses 416. This is TOO SMALL for fire detection.
#   Fire/smoke often starts as a small region — 640 preserves detail.
#   VRAM impact: 640 uses ~2.4x more than 416, but 16GB handles it fine.
#
# [batch=-1]
#   Auto-batch: YOLOv8 benchmarks your GPU and picks the largest batch
#   that fits ~60% VRAM. Much safer than hardcoding batch=64 which may OOM.
#   On T4/P100 with imgsz=640, expect batch=16-32 auto-selected.
#
# [epochs=100 + patience=15]
#   50 epochs is often too few for domain-specific fine-tuning.
#   100 epochs with patience=15 means training will stop early if
#   validation mAP hasn't improved in 15 epochs, preventing waste.
#
# [optimizer=AdamW]
#   Better generalization than default SGD for small/medium datasets.
#   AdamW decouples weight decay from the gradient update, which
#   helps prevent overfitting on fire detection datasets.
#
# [lr0=0.001, lrf=0.01]
#   Lower initial LR than default (0.01) because we're fine-tuning
#   from COCO pretrained weights — large LR would destroy features.
#   lrf=0.01 means the LR decays to 1% of initial by end.
#
# [warmup_epochs=5]
#   Longer warmup (default is 3) gives the model time to adapt
#   pretrained features to fire/smoke without early gradient shock.
#
# [mosaic=1.0, close_mosaic=10]
#   Mosaic augmentation helps with small object detection by
#   compositing 4 images into 1 tile. Disabled in last 10 epochs
#   so the model fine-tunes on clean, unaugmented examples.
#
# [mixup=0.15]
#   Blends two images together. Helps the model learn to detect
#   fire/smoke through partial occlusion and complex backgrounds.
#   0.15 is a moderate value — not too aggressive.
#
# [hsv_h, hsv_s, hsv_v]
#   Color jitter is critical for fire detection because fire/smoke
#   color varies enormously (white smoke, black smoke, orange flames,
#   blue flames). Increased from defaults.
#
# [degrees, translate, scale, flipud]
#   Geometric augmentations for rotational/scale invariance.
#   flipud=0.3 adds vertical flips — important for ceiling cameras.
#
# [cache="ram"]
#   Loads entire dataset into RAM for speed. On Kaggle you get ~13GB.
#   If your dataset is >10GB images, switch to cache="disk" or False.

TRAIN_CONFIG = dict(
    # ── Data ──
    data=data_path,

    # ── Architecture ──
    imgsz=640,                # ← was 416 — too small for fire detection
    
    # ── Batch & Epochs ──
    batch=-1,                 # ← auto-batch (was hardcoded 64 — risky)
    epochs=100,               # ← was 50 — more room to converge
    patience=15,              # ← was 10 — a bit more patience

    # ── Optimizer ──
    optimizer="AdamW",        # ← better than default SGD for fine-tuning
    lr0=0.001,                # ← lower initial LR for transfer learning
    lrf=0.01,                 # ← final LR = lr0 * lrf = 0.00001
    weight_decay=0.0005,      # ← L2 regularization
    warmup_epochs=5.0,        # ← longer warmup for stability
    warmup_momentum=0.8,      # ← default, good starting point

    # ── Augmentation (Fire-Specific) ──
    mosaic=1.0,               # ← keep mosaic ON
    close_mosaic=10,          # ← disable mosaic for last 10 epochs
    mixup=0.15,               # ← moderate image blending
    copy_paste=0.1,           # ← paste fire instances onto backgrounds
    hsv_h=0.02,               # ← hue shift (fire color variation)
    hsv_s=0.8,                # ← saturation (smoke is desaturated)
    hsv_v=0.5,                # ← brightness (night fires vs day fires)
    degrees=15.0,             # ← slight rotation
    translate=0.2,            # ← positional shift
    scale=0.6,                # ← scale variation (distant vs close fire)
    fliplr=0.5,               # ← horizontal flip
    flipud=0.3,               # ← vertical flip (ceiling cameras)
    perspective=0.001,        # ← slight perspective warp
    erasing=0.2,              # ← random erasing (occlusion robustness)

    # ── Hardware ──
    device=device,
    workers=4,                # ← Kaggle has 4 CPU cores
    amp=True,                 # ← mixed precision (saves VRAM + faster)
    cache="ram",              # ← load dataset into RAM

    # ── Saving & Logging ──
    project="/kaggle/working/yolo_runs",
    name="fire_v1",
    val=True,
    save=True,
    save_period=10,           # ← checkpoint every 10 epochs
    plots=True,               # ← generate training plots

    # ── Reproducibility ──
    seed=42,
    deterministic=True,       # ← reproducible results
)


# ──────────────────────────────────────────────
# 5. TRAIN
# ──────────────────────────────────────────────
print("\n" + "=" * 60)
print("STARTING TRAINING")
print("=" * 60)
for k, v in TRAIN_CONFIG.items():
    print(f"  {k:20s} = {v}")
print("=" * 60)

results = model.train(**TRAIN_CONFIG)


# ──────────────────────────────────────────────
# 6. EVALUATION ON VALIDATION SET
# ──────────────────────────────────────────────
print("\n" + "=" * 60)
print("VALIDATION METRICS")
print("=" * 60)

metrics = model.val(
    data=data_path,
    imgsz=640,
    batch=-1,
    device=device,
    split="val",
)

# Print key metrics
print(f"\n  mAP50      : {metrics.box.map50:.4f}")
print(f"  mAP50-95   : {metrics.box.map:.4f}")
print(f"  Precision  : {metrics.box.mp:.4f}")
print(f"  Recall     : {metrics.box.mr:.4f}")

# Per-class breakdown
if hasattr(metrics.box, 'ap_class_index'):
    class_names = model.names
    print("\n  Per-Class AP50:")
    for i, ap in enumerate(metrics.box.ap50):
        cname = class_names.get(i, f"class_{i}")
        print(f"    {cname:15s} : {ap:.4f}")

# Fire detection specific: Recall is MORE important than Precision
# (a missed fire is worse than a false alarm)
recall = metrics.box.mr
if recall < 0.85:
    print("\n  ⚠️  WARNING: Recall is below 0.85!")
    print("     For fire safety, aim for Recall ≥ 0.90.")
    print("     Consider: lower conf threshold, more training data, or larger model.")


# ──────────────────────────────────────────────
# 7. EXPORT FOR PRODUCTION
# ──────────────────────────────────────────────
# Export the best weights to an optimized format for deployment.
# The .pt file will be used by our FastAPI backend (yolo_detector.py).

best_model_path = f"/kaggle/working/yolo_runs/fire_v1/weights/best.pt"
print(f"\n  Best weights: {best_model_path}")
print(f"  Copy this file to: backend/app/ai/fire_detection_model.pt")

# Optional: Export to ONNX for cross-platform deployment
# model.export(format="onnx", imgsz=640, simplify=True)

print("\n✅ Training complete!")
