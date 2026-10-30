from typing import Optional
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except Exception:
    pyautogui = None
    PYAUTOGUI_AVAILABLE = False

# The trained 25-sign LSTM model and its predictor are bundled in this package.
PREDICTOR_AVAILABLE = False
PREDICTOR_IMPORT_ERROR = None
predict_sequence = None
try:
    from src.predictor import predict_sequence as _predict_sequence
    predict_sequence = _predict_sequence
    PREDICTOR_AVAILABLE = True
except Exception as exc:
    PREDICTOR_IMPORT_ERROR = str(exc)

app = FastAPI(title="ISLBridge AI API", description="ISL translation and desktop gesture API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

class PredictionRequest(BaseModel):
    sequence: list[list[float]]

class GestureRequest(BaseModel):
    action: str = Field(min_length=1)
    x: Optional[float] = None
    y: Optional[float] = None

@app.get("/")
def home():
    return {"status": "success", "message": "ISLBridge AI API is running"}

@app.get("/health")
def health():
    model_path = Path(__file__).resolve().parent / "models" / "isl_lstm_25_signs_best.keras"
    return {
        "status": "healthy",
        "translator_model_available": PREDICTOR_AVAILABLE and model_path.is_file(),
        "model_file_present": model_path.is_file(),
        "gesture_control_available": PYAUTOGUI_AVAILABLE,
        "predictor_import_error": PREDICTOR_IMPORT_ERROR,
    }

@app.post("/predict")
def predict(request: PredictionRequest):
    arr = np.asarray(request.sequence, dtype=np.float32)
    if arr.shape != (30, 126):
        raise HTTPException(status_code=400, detail={"error": "Invalid sequence shape", "received_shape": list(arr.shape), "expected_shape": [30, 126]})
    if not PREDICTOR_AVAILABLE or predict_sequence is None:
        raise HTTPException(status_code=503, detail="Translator model is unavailable. Install backend requirements, confirm the bundled model exists, and restart the API. Check /health and the backend terminal for TensorFlow or model-loading errors.")
    try:
        result = predict_sequence(arr)
        return {"success": True, "prediction": result["label"], "confidence": result["confidence"], "confidence_percent": result.get("confidence_percent", float(result["confidence"]) * 100), "is_confident": result.get("is_confident", True), "class_id": result.get("class_id")}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")

@app.post("/gesture")
def gesture(request: GestureRequest):
    if not PYAUTOGUI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Desktop control needs pyautogui and a local desktop session. Install requirements and restart the API.")
    action = request.action.strip().lower()
    try:
        width, height = pyautogui.size()
        if action == "move":
            if request.x is None or request.y is None:
                raise HTTPException(status_code=400, detail="x and y are required for move")
            x = min(max(float(request.x), 0.02), 0.98)
            y = min(max(float(request.y), 0.02), 0.98)
            pyautogui.moveTo(int(x * width), int(y * height), duration=0)
            return {"success": True, "action": "move"}
        if action == "click":
            pyautogui.click()
            return {"success": True, "action": "click"}
        if action == "enter":
            pyautogui.press("enter")
            return {"success": True, "action": "enter"}
        raise HTTPException(status_code=400, detail="Unsupported action. Use move, click or enter.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Desktop gesture failed: {exc}")
