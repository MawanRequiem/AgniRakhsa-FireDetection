"""
Model Registry — Config-driven model loading.

The registry maps model type strings (from env vars) to detector classes.
It loads the appropriate model once at startup and provides a FastAPI
dependency to access the detector in route handlers.

To add a new model type:
1. Create a detector class that inherits from BaseDetector
2. Register it here with `ModelRegistry.register()`
3. Set MODEL_TYPE env var to the registered name
"""

import logging
from typing import Type

from app.ai.base import BaseDetector
from app.ai.yolo_detector import YOLOFireDetector

logger = logging.getLogger(__name__)

# ─── Global Registry ──────────────────────────────────────────────────────────

_DETECTOR_REGISTRY: dict[str, Type[BaseDetector]] = {}
_active_detector: BaseDetector | None = None


def register(name: str, detector_class: Type[BaseDetector]) -> None:
    """
    Register a detector implementation.
    
    Args:
        name: Short identifier (e.g. "yolo", "custom_rf")
        detector_class: Class that inherits from BaseDetector
    """
    _DETECTOR_REGISTRY[name.lower()] = detector_class
    logger.info(f"Registered detector: {name} -> {detector_class.__name__}")


def get_available_types() -> list[str]:
    """Return all registered detector type names."""
    return list(_DETECTOR_REGISTRY.keys())


def load_detector(
    model_type: str,
    model_path: str,
    confidence_threshold: float = 0.25,
    input_size: int = 416,
) -> BaseDetector:
    """
    Instantiate and load a detector by type name.
    
    Args:
        model_type: Registered type name (e.g. "yolo")
        model_path: Path to the model weights file
        confidence_threshold: Minimum confidence for detections
        input_size: Input image size (square)
        
    Returns:
        A loaded BaseDetector instance ready for inference.
        
    Raises:
        ValueError: If model_type is not registered.
        RuntimeError: If model fails to load.
    """
    global _active_detector
    
    detector_class = _DETECTOR_REGISTRY.get(model_type.lower())
    if detector_class is None:
        available = ", ".join(get_available_types())
        raise ValueError(
            f"Unknown model type: '{model_type}'. "
            f"Available types: [{available}]. "
            f"Register new types with ModelRegistry.register()."
        )
    
    logger.info(f"Initializing detector: type={model_type}, path={model_path}")
    detector = detector_class(
        model_path=model_path,
        confidence_threshold=confidence_threshold,
        input_size=input_size,
    )
    detector.load_model()
    
    _active_detector = detector
    logger.info(f"Detector loaded and active: {detector.get_model_info().name}")
    return detector


def get_detector() -> BaseDetector:
    """
    Get the currently active detector instance.
    
    Use this as a FastAPI dependency:
        detector: BaseDetector = Depends(get_detector)
        
    Raises:
        RuntimeError: If no detector has been loaded yet.
    """
    if _active_detector is None:
        raise RuntimeError(
            "No AI model has been loaded. "
            "Ensure the model is loaded during application startup via the lifespan event."
        )
    return _active_detector


# ─── Register Built-in Detectors ──────────────────────────────────────────────

register("yolo", YOLOFireDetector)

# Future detector types can be registered here:
# register("custom_rf", CustomRandomForestDetector)
# register("efficientnet", EfficientNetDetector)
