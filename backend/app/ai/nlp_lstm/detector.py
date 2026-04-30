"""
Bi-LSTM NLP Fire News Classification Detector.

Loads the trained Bi-LSTM model (model_lstm.h5) with its tokenizer and
label encoder for classifying text as fire-related sentiment.

Model artifacts (stored in this directory):
  - model_lstm.h5       : Keras Bi-LSTM model weights
  - tokenizer.pkl       : Keras Tokenizer fitted on training data
  - label_encoder.pkl   : sklearn LabelEncoder for class labels

Architecture (from train_model.py):
  - Embedding(20000, 128) → SpatialDropout1D(0.3)
  - Bidirectional LSTM(64) → Bidirectional LSTM(32)
  - GlobalAveragePooling1D → Dense(64, relu) → Dropout(0.5)
  - Dense(num_classes, softmax)
  - Input: tokenized text padded to max_len=120
  - N-Gram augmentation (bigrams) applied before tokenization
"""

import os
import pickle
import logging
import numpy as np

from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences

logger = logging.getLogger(__name__)

# ─── Constants matching training config ──────────────────────────────────────
MAX_LEN = 120  # Matches train_model.py


class LSTMFireNewsDetector:
    """
    Production inference wrapper for the Bi-LSTM NLP model.

    Usage:
        detector = LSTMFireNewsDetector()
        detector.load("backend/app/ai/nlp_lstm")

        result = detector.predict("Kebakaran besar di pasar!")
        # → {"label": "NEGATIVE", "confidence": 95.2}
    """

    def __init__(self):
        self._model = None
        self._tokenizer = None
        self._label_encoder = None

    def load(self, model_dir: str = None) -> None:
        """
        Load the LSTM model, tokenizer, and label encoder from disk.

        Args:
            model_dir: Directory containing model_lstm.h5, tokenizer.pkl,
                       and label_encoder.pkl. Defaults to this file's directory.
        """
        if model_dir is None:
            model_dir = os.path.dirname(os.path.abspath(__file__))

        model_path = os.path.join(model_dir, "model_lstm.h5")
        tokenizer_path = os.path.join(model_dir, "tokenizer.pkl")
        label_encoder_path = os.path.join(model_dir, "label_encoder.pkl")

        # Validate files exist
        for path, name in [
            (model_path, "LSTM model"),
            (tokenizer_path, "Tokenizer"),
            (label_encoder_path, "Label encoder"),
        ]:
            if not os.path.exists(path):
                raise FileNotFoundError(f"{name} not found: {path}")

        logger.info(f"Loading Bi-LSTM model from: {model_path}")
        self._model = load_model(model_path)

        with open(tokenizer_path, "rb") as f:
            self._tokenizer = pickle.load(f)
        with open(label_encoder_path, "rb") as f:
            self._label_encoder = pickle.load(f)

        logger.info(
            f"Bi-LSTM model loaded — "
            f"Classes: {list(self._label_encoder.classes_)}, "
            f"Max length: {MAX_LEN}"
        )

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @staticmethod
    def apply_ngram_context(text: str) -> str:
        """Add bigram context to match training preprocessing."""
        words = str(text).split()
        if len(words) < 2:
            return text
        bigrams = ["_".join(words[i : i + 2]) for i in range(len(words) - 1)]
        return text + " " + " ".join(bigrams)

    def predict(self, text: str) -> dict:
        """
        Run classification on a single text.

        Args:
            text: Preprocessed/cleaned text string.

        Returns:
            Dict with keys: label, confidence, class_probabilities
        """
        if not self.is_loaded:
            raise RuntimeError("Model not loaded. Call load() first.")

        context_text = self.apply_ngram_context(text)
        seq = self._tokenizer.texts_to_sequences([context_text])
        padded = pad_sequences(seq, maxlen=MAX_LEN, padding="post", truncating="post")

        # Direct call is faster than .predict() for single samples
        pred_tensor = self._model(padded, training=False)
        pred = pred_tensor.numpy()

        result_idx = np.argmax(pred)
        label = self._label_encoder.inverse_transform([result_idx])[0]
        confidence = float(np.max(pred))

        return {
            "label": label,
            "confidence": round(confidence * 100, 2),
            "class_probabilities": {
                cls: round(float(prob) * 100, 2)
                for cls, prob in zip(self._label_encoder.classes_, pred[0])
            },
        }

    def get_model_info(self) -> dict:
        """Return metadata about the loaded LSTM model."""
        return {
            "name": "bi-lstm-fire-news",
            "model_type": "nlp_lstm",
            "classes": list(self._label_encoder.classes_) if self._label_encoder else [],
            "max_length": MAX_LEN,
            "is_loaded": self.is_loaded,
        }
