"""Inference helper for the bundled ISLBridge AI 25-sign LSTM model."""
from __future__ import annotations
import json
import os
from pathlib import Path
from functools import lru_cache
import numpy as np
import tensorflow as tf

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.getenv("ISL_MODEL_PATH", BASE_DIR / "models" / "isl_lstm_25_signs_best.keras"))
LABEL_PATH = Path(os.getenv("ISL_LABEL_MAP_PATH", BASE_DIR / "models" / "label_map.json"))
CONFIDENCE_THRESHOLD = float(os.getenv("ISL_CONFIDENCE_THRESHOLD", "0.70"))

@lru_cache(maxsize=1)
def _load_assets():
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(f"Trained model not found: {MODEL_PATH}")
    if not LABEL_PATH.is_file():
        raise FileNotFoundError(f"Label map not found: {LABEL_PATH}")
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    labels = json.loads(LABEL_PATH.read_text(encoding="utf-8"))
    # JSON label maps can be either {label: id} or {id: label}; normalize both.
    if labels and all(isinstance(v, int) for v in labels.values()):
        id_to_label = {int(v): str(k) for k, v in labels.items()}
    else:
        id_to_label = {int(k): str(v) for k, v in labels.items()}
    output_count = int(model.output_shape[-1])
    if len(id_to_label) != output_count:
        raise ValueError(f"Label map has {len(id_to_label)} labels but model outputs {output_count} classes")
    return model, id_to_label

def predict_sequence(sequence):
    arr = np.asarray(sequence, dtype=np.float32)
    if arr.shape != (30, 126):
        raise ValueError(f"Expected input shape (30, 126), got {arr.shape}")
    if not np.isfinite(arr).all():
        raise ValueError("Input sequence contains NaN or infinite values")
    model, id_to_label = _load_assets()
    probs = np.asarray(model.predict(arr[np.newaxis, ...], verbose=0))[0]
    class_id = int(np.argmax(probs))
    confidence = float(probs[class_id])
    label = id_to_label[class_id] if confidence >= CONFIDENCE_THRESHOLD else "Unknown"
    return {
        "label": label,
        "confidence": confidence,
        "confidence_percent": round(confidence * 100, 2),
        "is_confident": confidence >= CONFIDENCE_THRESHOLD,
        "class_id": class_id,
    }
