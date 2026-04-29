"""
Sensor Anomaly Detector — Isolation Forest inference for IoT sensor data.

Loads the pre-trained Isolation Forest model and StandardScaler,
maintains a per-room sliding window buffer of recent sensor readings,
extracts the same 25 features used during training, and outputs a
normalized anomaly score (0.0 = safe, 1.0 = critical).

This score feeds into the late fusion engine alongside the YOLO image score.

Feature set (verified from scaler.feature_names_in_):
  Per sensor (cng, co, flame_presence, lpg, smoke):
    {sensor}_max, {sensor}_min, {sensor}_slope, {sensor}_last, {sensor}_max_jump
  Total: 5 sensors × 5 features = 25 features
"""

import math
import logging
from pathlib import Path
from collections import deque
from threading import Lock

import numpy as np
import joblib

logger = logging.getLogger(__name__)

# ─── Sensor Type Mapping ─────────────────────────────────────────────────────
# Maps our ESP32 sensor type names → the column names used during training.
# The training data had columns: cng, co, flame_presence, lpg, smoke
# (alphabetical order from pandas pivot_table).

SENSOR_TYPE_MAP: dict[str, str] = {
    "MQ4":   "cng",             # Methane / CNG
    "MQ9B":  "co",              # Carbon Monoxide
    "FLAME": "flame_presence",  # IR flame detection
    "MQ6":   "lpg",             # LPG / Butane
    "MQ2":   "smoke",           # Smoke / combustible gas
}

# Training column order (alphabetical from pivot — confirmed by user).
TRAINING_COLUMNS = sorted(SENSOR_TYPE_MAP.values())
# → ['cng', 'co', 'flame_presence', 'lpg', 'smoke']

# Feature suffixes per sensor (verified from scaler.feature_names_in_)
FEATURE_SUFFIXES = ["max", "min", "slope", "last", "max_jump"]

WINDOW_SIZE = 9  # Must match training (training_script.py line 61)

# Build exact feature column order matching scaler.feature_names_in_
FEATURE_COLUMNS = [
    f"{col}_{suffix}"
    for col in TRAINING_COLUMNS
    for suffix in FEATURE_SUFFIXES
]
EXPECTED_FEATURE_COUNT = len(FEATURE_COLUMNS)  # 25


class SensorAnomalyDetector:
    """
    Production inference wrapper for the Isolation Forest sensor model.

    Usage:
        detector = SensorAnomalyDetector()
        detector.load("app/ai/iot_sensor")

        # Called every time sensor readings arrive:
        detector.ingest(room_id, {"MQ2": 150.0, "MQ4": 80.0, ...})

        # Called during fusion:
        if detector.has_enough_data(room_id):
            score = detector.predict(room_id)  # 0.0-1.0
    """

    def __init__(self):
        self._model = None
        self._scaler = None
        self._buffers: dict[str, deque] = {}  # room_id → deque of snapshots
        self._lock = Lock()

    def load(self, model_dir: str) -> None:
        """
        Load the Isolation Forest model and fitted StandardScaler.

        Args:
            model_dir: Directory containing isolation_forest_model.pkl and scaler.pkl
        """
        model_dir = Path(model_dir)
        model_path = model_dir / "isolation_forest_model.pkl"
        scaler_path = model_dir / "scaler.pkl"

        if not model_path.exists():
            raise FileNotFoundError(f"Isolation Forest model not found: {model_path}")
        if not scaler_path.exists():
            raise FileNotFoundError(f"Scaler not found: {scaler_path}")

        self._model = joblib.load(model_path)
        self._scaler = joblib.load(scaler_path)

        # Validate scaler expects our feature count
        n_features = self._scaler.n_features_in_
        if n_features != EXPECTED_FEATURE_COUNT:
            raise ValueError(
                f"Scaler expects {n_features} features but detector produces "
                f"{EXPECTED_FEATURE_COUNT}. Feature mismatch — check column order."
            )

        # Cross-validate column names if available
        if hasattr(self._scaler, "feature_names_in_"):
            expected = list(self._scaler.feature_names_in_)
            if expected != FEATURE_COLUMNS:
                logger.warning(
                    f"Feature column order mismatch!\n"
                    f"  Scaler expects: {expected}\n"
                    f"  Detector builds: {FEATURE_COLUMNS}"
                )
                # Override with scaler's actual order for safety
                FEATURE_COLUMNS.clear()
                FEATURE_COLUMNS.extend(expected)

        logger.info(
            f"Sensor anomaly model loaded: {model_path.name} "
            f"({EXPECTED_FEATURE_COUNT} features, window={WINDOW_SIZE})"
        )

    @property
    def is_loaded(self) -> bool:
        return self._model is not None and self._scaler is not None

    def ingest(self, room_id: str, sensor_snapshot: dict[str, float]) -> None:
        """
        Add a sensor reading snapshot to the room's sliding window buffer.

        Args:
            room_id: Room identifier (string UUID).
            sensor_snapshot: Dict mapping sensor_type → value.
                             Example: {"MQ2": 150.0, "MQ4": 80.0, "FLAME": 3500.0, ...}
        """
        # Map ESP32 sensor types → training column names
        mapped = {}
        for sensor_type, value in sensor_snapshot.items():
            training_name = SENSOR_TYPE_MAP.get(sensor_type)
            if training_name is not None:
                mapped[training_name] = float(value)

        # Only ingest if we have at least one relevant sensor
        if not mapped:
            return

        with self._lock:
            if room_id not in self._buffers:
                self._buffers[room_id] = deque(maxlen=WINDOW_SIZE)
            self._buffers[room_id].append(mapped)

    def has_enough_data(self, room_id: str) -> bool:
        """Check if the room's buffer has enough samples for a full window."""
        if not self.is_loaded:
            return False
        with self._lock:
            buf = self._buffers.get(room_id)
            return buf is not None and len(buf) >= WINDOW_SIZE

    def predict(self, room_id: str) -> float:
        """
        Run Isolation Forest inference on the room's sensor window.

        Returns:
            Normalized anomaly score: 0.0 (safe) → 1.0 (critical).

        Raises:
            RuntimeError: If model not loaded or insufficient data.
        """
        if not self.is_loaded:
            raise RuntimeError("Sensor anomaly model not loaded")

        with self._lock:
            buf = self._buffers.get(room_id)
            if buf is None or len(buf) < WINDOW_SIZE:
                raise RuntimeError(
                    f"Insufficient data for room {room_id}: "
                    f"{len(buf) if buf else 0}/{WINDOW_SIZE} samples"
                )
            # Snapshot the buffer so we can release the lock
            window_data = list(buf)

        # ─── Feature Engineering ─────────────────────────────────────────
        # Matches the actual features used by the trained model:
        #   max, min, slope, last, max_jump (per sensor)
        features = {}

        for col in TRAINING_COLUMNS:
            # Extract values for this sensor across the window
            values = np.array([
                sample.get(col, 0.0) for sample in window_data
            ], dtype=np.float64)

            features[f"{col}_max"] = float(np.max(values))
            features[f"{col}_min"] = float(np.min(values))
            features[f"{col}_slope"] = float((values[-1] - values[0]) / WINDOW_SIZE)
            features[f"{col}_last"] = float(values[-1])

            # max_jump: largest absolute difference between consecutive readings
            if len(values) > 1:
                diffs = np.abs(np.diff(values))
                features[f"{col}_max_jump"] = float(np.max(diffs))
            else:
                features[f"{col}_max_jump"] = 0.0

        # Build feature vector as DataFrame with column names (avoids sklearn warning)
        import pandas as pd
        feature_df = pd.DataFrame(
            [[features[col] for col in FEATURE_COLUMNS]],
            columns=FEATURE_COLUMNS,
        )

        # Scale using the fitted StandardScaler
        X_scaled = self._scaler.transform(feature_df)

        # Run Isolation Forest
        # decision_function: positive = normal, negative = anomaly
        raw_score = self._model.decision_function(X_scaled)[0]
        prediction = self._model.predict(X_scaled)[0]  # 1 = normal, -1 = anomaly

        # Normalize to 0-1 using sigmoid: score=0 → 0.5, negative → 1.0
        sensor_score = 1.0 / (1.0 + math.exp(raw_score * 10))

        logger.debug(
            f"Sensor IF prediction for room {room_id}: "
            f"raw_score={raw_score:.4f} pred={prediction} "
            f"normalized={sensor_score:.4f}"
        )

        return round(sensor_score, 4)

    def get_buffer_status(self) -> dict[str, int]:
        """Return buffer fill levels for all rooms (for debugging/monitoring)."""
        with self._lock:
            return {
                room_id: len(buf)
                for room_id, buf in self._buffers.items()
            }

