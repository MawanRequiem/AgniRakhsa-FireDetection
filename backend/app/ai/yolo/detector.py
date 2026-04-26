"""
YOLOv8 Fire Detection Implementation.

Concrete implementation of BaseDetector using the Ultralytics YOLO library.
Loads the trained YOLOv8n fire detection model and runs inference on images.
"""

import time
import logging
from PIL import Image
from ultralytics import YOLO

from app.ai.base import BaseDetector
from app.ai.schemas import BoundingBox, DetectionResult, ModelInfo

logger = logging.getLogger(__name__)


class YOLOFireDetector(BaseDetector):
    """
    Fire detection using YOLOv8.
    
    This detector loads a custom-trained YOLOv8 model (.pt file)
    and runs object detection to identify fire/smoke in images.
    
    Matches the training configuration:
    - Input size: 416x416
    - Model: YOLOv8n (nano) architecture
    """

    def load_model(self) -> None:
        """Load the YOLO model from the .pt weights file."""
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Model file not found at: {self.model_path}. "
                f"Please ensure the .pt file exists at the configured MODEL_PATH."
            )
        
        logger.info(f"Loading YOLO model from: {self.model_path}")
        try:
            self._model = YOLO(str(self.model_path))
            # Run a warmup inference to initialize the model pipeline
            logger.info("Running warmup inference...")
            warmup_img = Image.new("RGB", (self.input_size, self.input_size), color=(0, 0, 0))
            self._model.predict(warmup_img, conf=self.confidence_threshold, verbose=False)
            logger.info(
                f"YOLO model loaded successfully. "
                f"Classes: {self._model.names}, "
                f"Input size: {self.input_size}x{self.input_size}"
            )
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            raise RuntimeError(f"Failed to load YOLO model: {e}") from e

    def detect(self, image: Image.Image) -> DetectionResult:
        """
        Run YOLO inference on an image.
        
        Args:
            image: PIL Image in RGB mode.
            
        Returns:
            DetectionResult with all detected fire/smoke bounding boxes.
        """
        if not self.is_loaded:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        start_time = time.perf_counter()
        
        # Run inference
        results = self._model.predict(
            image,
            conf=self.confidence_threshold,
            imgsz=self.input_size,
            verbose=False,
        )
        
        processing_time_ms = int((time.perf_counter() - start_time) * 1000)
        
        # Parse YOLO results into our standardized format
        detections: list[BoundingBox] = []
        
        if results and len(results) > 0:
            result = results[0]  # Single image, single result
            
            if result.boxes is not None and len(result.boxes) > 0:
                for box in result.boxes:
                    coords = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                    confidence = float(box.conf[0])
                    class_id = int(box.cls[0])
                    class_name = self._model.names.get(class_id, f"class_{class_id}")
                    
                    detections.append(BoundingBox(
                        x1=coords[0],
                        y1=coords[1],
                        x2=coords[2],
                        y2=coords[3],
                        confidence=confidence,
                        class_name=class_name,
                        class_id=class_id,
                    ))
        
        # Find the highest confidence detection
        max_conf = 0.0
        det_class = None
        if detections:
            best = max(detections, key=lambda d: d.confidence)
            max_conf = best.confidence
            det_class = best.class_name
        
        return DetectionResult(
            detections=detections,
            model_name=self._get_model_name(),
            model_version=self._get_model_version(),
            processing_time_ms=processing_time_ms,
            image_width=image.width,
            image_height=image.height,
            max_confidence=max_conf,
            detection_class=det_class,
        )

    def get_model_info(self) -> ModelInfo:
        """Return metadata about the loaded YOLO model."""
        classes = []
        if self._model and hasattr(self._model, "names"):
            classes = list(self._model.names.values())
        
        return ModelInfo(
            name=self._get_model_name(),
            version=self._get_model_version(),
            model_type="yolo",
            classes=classes,
            input_size=self.input_size,
            confidence_threshold=self.confidence_threshold,
        )

    def _get_model_name(self) -> str:
        """Extract model name from the file path."""
        return self.model_path.stem  # e.g. "fire_detection_model"

    def _get_model_version(self) -> str:
        """Get the YOLO model architecture version."""
        if self._model and hasattr(self._model, "cfg"):
            return str(getattr(self._model, "cfg", "yolov8n"))
        return "yolov8n"
