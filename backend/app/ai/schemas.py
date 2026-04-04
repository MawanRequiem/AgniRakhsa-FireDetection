"""
AI Detection Result Schemas.

Shared Pydantic models for all detector implementations.
These are the data contracts between the AI engine and the rest of the backend.
"""

from pydantic import BaseModel, Field
from typing import Optional


class BoundingBox(BaseModel):
    """A single detected object with bounding box coordinates."""
    x1: float = Field(..., description="Top-left X coordinate (pixels)")
    y1: float = Field(..., description="Top-left Y coordinate (pixels)")
    x2: float = Field(..., description="Bottom-right X coordinate (pixels)")
    y2: float = Field(..., description="Bottom-right Y coordinate (pixels)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    class_name: str = Field(..., description="Detected class label (e.g. 'fire', 'smoke')")
    class_id: int = Field(..., description="Numeric class ID from the model")


class DetectionResult(BaseModel):
    """Result of running inference on a single image."""
    detections: list[BoundingBox] = Field(default_factory=list, description="List of detected objects")
    model_name: str = Field(..., description="Model identifier (e.g. 'yolov8n-fire')")
    model_version: str = Field(default="unknown", description="Model version string")
    processing_time_ms: int = Field(..., ge=0, description="Inference time in milliseconds")
    image_width: int = Field(..., gt=0, description="Input image width in pixels")
    image_height: int = Field(..., gt=0, description="Input image height in pixels")
    max_confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Highest confidence score across all detections")
    detection_class: Optional[str] = Field(default=None, description="Class of highest-confidence detection")

    @property
    def has_fire(self) -> bool:
        """Check if any fire-class detection was found."""
        return any(d.class_name.lower() in ("fire", "flame") for d in self.detections)

    @property
    def has_smoke(self) -> bool:
        """Check if any smoke-class detection was found."""
        return any(d.class_name.lower() == "smoke" for d in self.detections)


class ModelInfo(BaseModel):
    """Metadata about the currently loaded AI model."""
    name: str = Field(..., description="Model identifier")
    version: str = Field(default="unknown", description="Model version")
    model_type: str = Field(..., description="Model type (e.g. 'yolo', 'custom')")
    classes: list[str] = Field(default_factory=list, description="List of detectable class names")
    input_size: int = Field(..., description="Expected input image size (square, in pixels)")
    confidence_threshold: float = Field(..., description="Minimum confidence threshold for detections")
