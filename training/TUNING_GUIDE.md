# YOLOv8 Fire Detection Training — Tuning Guide

## What Changed (Your Script → Tuned Script)

| Parameter | Your Value | Tuned Value | Why |
|---|---|---|---|
| `imgsz` | `416` | `640` | 416 is too small — fire/smoke starts as small regions that get lost at low resolution. 640 is the standard that preserves detail while fitting in 16GB VRAM. |
| `batch` | `64` | `-1` (auto) | Hardcoding 64 will OOM on Kaggle T4 at imgsz=640. Auto-batch benchmarks your GPU and picks the largest safe batch (~16-32). |
| `epochs` | `50` | `100` | 50 is often insufficient for domain-specific fine-tuning. 100 epochs with early stopping gives the model more room to converge without wasting time. |
| `patience` | `10` | `15` | Slightly more patience prevents premature stopping during learning rate warmup or plateau phases. |
| `optimizer` | *(default SGD)* | `AdamW` | AdamW provides better convergence on small/medium fire datasets. Decouples weight decay from gradient updates, reducing overfitting. |
| `lr0` | *(default 0.01)* | `0.001` | We're fine-tuning from COCO pretrained weights. A high LR (0.01) would destroy useful pretrained features. 0.001 is gentler. |
| `lrf` | *(default 0.01)* | `0.01` | Final LR = 0.001 × 0.01 = 0.00001. This cosine decay gives strong convergence at the end. |
| `warmup_epochs` | *(default 3)* | `5` | Longer warmup prevents gradient shock when the fire-specific head starts learning. |
| `mixup` | *(default 0)* | `0.15` | Blends two images. Teaches the model to detect fire through partial occlusion and complex backgrounds. |
| `hsv_s` | *(default 0.7)* | `0.8` | Increased saturation jitter because smoke is grey/desaturated while fire is highly saturated. |
| `hsv_v` | *(default 0.4)* | `0.5` | Increased brightness jitter for night-fire vs day-fire variation. |
| `scale` | *(default 0.5)* | `0.6` | More aggressive scale variation helps detect fire at different distances. |
| `flipud` | *(default 0)* | `0.3` | Vertical flips simulate ceiling-mounted cameras looking down. |
| `erasing` | *(default 0.4)* | `0.2` | Random erasing for occlusion robustness, slightly reduced from default. |
| `copy_paste` | *(default 0)* | `0.1` | Copies fire instances from one image and pastes onto another's background — great for rare-class augmentation. |
| `amp` | *(not set)* | `True` | Mixed precision (FP16) saves ~30% VRAM and speeds up training ~20%. Enabled by default in YOLOv8 but worth being explicit. |
| `seed` | *(not set)* | `42` | Reproducibility — you can compare runs fairly. |
| `deterministic` | *(not set)* | `True` | Full reproducibility for academic reporting. |

---

## Understanding the Key Concepts

### Why `imgsz=640` instead of `416`?

VRAM usage scales with the **square** of imgsz:
- `416²` = 173,056 pixels
- `640²` = 409,600 pixels (2.4× more)

But fire/smoke detection accuracy improves dramatically because small fire ignition points (maybe 20×20 pixels in the original image) become:
- At 416: ~13×13 pixels → hard to detect
- At 640: ~20×20 pixels → detectable

### Why `batch=-1` (auto-batch)?

Hardcoding `batch=64` at `imgsz=640` would need ~24GB VRAM — your Kaggle T4 only has 16GB. The auto-batch feature:
1. Runs a quick benchmark with increasing batch sizes
2. Finds the largest batch that uses ≤60% of available VRAM
3. Leaves headroom for gradients and activations

On T4 with imgsz=640 + YOLOv8n, expect auto-batch to select **batch=16-32**.

### Why `AdamW` instead of SGD?

| Optimizer | Best For | Fire Detection |
|---|---|---|
| **SGD + momentum** | Large datasets (>100K images), long training | Slower convergence, may get stuck |
| **AdamW** | Small/medium datasets, fine-tuning | Faster convergence, better generalization |
| **Adam** | Quick experiments | Tends to overfit without weight decay |

For a typical fire detection dataset (1K–50K images), AdamW converges in fewer epochs and generalizes better.

### Why focus on Recall over Precision?

In fire detection, the cost function is asymmetric:
- **False Negative** (missed fire) = 🔥 building burns down
- **False Positive** (false alarm) = 😅 annoying but harmless

Therefore:
- Target **Recall ≥ 0.90** (catch 90%+ of real fires)
- Accept lower Precision (some false alarms are OK)
- The Late Fusion engine compensates by correlating with sensor data

---

## After Training: Deployment Checklist

1. **Download `best.pt`** from `/kaggle/working/yolo_runs/fire_v1/weights/best.pt`
2. **Copy to backend**: `backend/app/ai/fire_detection_model.pt`
3. **Verify inference**:
   ```bash
   cd backend
   uv run python -c "
   from ultralytics import YOLO
   model = YOLO('app/ai/fire_detection_model.pt')
   print(model.names)
   print('✅ Model loaded successfully')
   "
   ```
4. **Restart backend**: The YOLO detector auto-loads on startup

---

## Advanced: Hyperparameter Search (Optional)

If you want to squeeze out more performance, use the Ultralytics built-in tuner:

```python
model = YOLO("yolov8n.pt")
model.tune(
    data="/kaggle/working/data.yaml",
    epochs=30,           # shorter epochs per trial
    iterations=30,       # 30 random mutations
    optimizer="AdamW",
    plots=True,
    save=True,
    val=True,
)
```

This uses a **genetic algorithm** to mutate hyperparameters and find optimal values. It takes ~30× longer than a single training run but can improve mAP by 2-5%.

---

## Model Size vs. Accuracy Tradeoff

| Model | Params | mAP50 (typical fire) | Inference Time (T4) | Recommended For |
|---|---|---|---|---|
| YOLOv8n | 3.2M | 0.75-0.85 | ~5ms | ✅ Real-time streaming (our use case) |
| YOLOv8s | 11.2M | 0.80-0.88 | ~10ms | Good balance |
| YOLOv8m | 25.9M | 0.83-0.90 | ~25ms | Higher accuracy, still fast |
| YOLOv8l | 43.7M | 0.85-0.92 | ~50ms | Best accuracy, slower |

**For AgniRakhsa**: YOLOv8n is the right choice because:
- We need real-time inference (~10-25 FPS from webcam streams)
- Late Fusion with sensors compensates for lower visual accuracy
- The nano model fits edge deployment if we later move to Raspberry Pi
