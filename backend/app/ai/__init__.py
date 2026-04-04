"""
AgniRakhsa AI Module.

Modular fire detection AI engine with swappable model support.

Usage:
    from app.ai import registry
    
    # At startup (in lifespan):
    registry.load_detector(model_type="yolo", model_path="app/ai/fire_detection_model.pt")
    
    # In route handlers:
    detector = registry.get_detector()
    result = detector.detect(image)
"""

from app.ai.base import BaseDetector
from app.ai.schemas import BoundingBox, DetectionResult, ModelInfo
from app.ai import registry

__all__ = [
    "BaseDetector",
    "BoundingBox",
    "DetectionResult",
    "ModelInfo",
    "registry",
]
