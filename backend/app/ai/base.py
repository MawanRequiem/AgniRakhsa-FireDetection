"""
Abstract Base Detector Protocol.

All AI detector implementations must inherit from BaseDetector.
This enables the Strategy pattern — swap models by changing config, not code.

To add a new detector:
1. Create a new file (e.g. `custom_detector.py`)
2. Subclass `BaseDetector`
3. Implement `load_model()`, `detect()`, `get_model_info()`
4. Register it in `registry.py`
"""

from abc import ABC, abstractmethod
from pathlib import Path
from PIL import Image

from app.ai.schemas import DetectionResult, ModelInfo


class BaseDetector(ABC):
    """
    Abstract base class for all fire detection models.
    
    Enforces a consistent interface so the rest of the system
    doesn't care which model is running underneath.
    """

    def __init__(self, model_path: str, confidence_threshold: float = 0.25, input_size: int = 416):
        self.model_path = Path(model_path)
        self.confidence_threshold = confidence_threshold
        self.input_size = input_size
        self._model = None

    @abstractmethod
    def load_model(self) -> None:
        """
        Load the model weights from disk into memory.
        Called once at application startup via the FastAPI lifespan.
        
        Raises:
            FileNotFoundError: If model file doesn't exist.
            RuntimeError: If model fails to load.
        """
        ...

    @abstractmethod
    def detect(self, image: Image.Image) -> DetectionResult:
        """
        Run inference on a single PIL Image.
        
        Args:
            image: A PIL.Image.Image in RGB mode.
            
        Returns:
            DetectionResult with bounding boxes, confidence scores, and metadata.
        """
        ...

    @abstractmethod
    def get_model_info(self) -> ModelInfo:
        """
        Return metadata about the currently loaded model.
        
        Returns:
            ModelInfo with name, version, supported classes, etc.
        """
        ...

    def health_check(self) -> bool:
        """Check if the model is loaded and ready for inference."""
        return self._model is not None

    @property
    def is_loaded(self) -> bool:
        """Whether the model has been loaded into memory."""
        return self._model is not None
