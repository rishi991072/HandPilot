"""Lightweight ISLBridge AI package checks. Run with: python VERIFY_PROJECT.py"""
from __future__ import annotations
import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
checks = []
def check(name: str, ok: bool, detail: str = "") -> None:
    checks.append((name, ok, detail))

model = ROOT / "backend" / "models" / "isl_lstm_25_signs_best.keras"
labels_path = ROOT / "backend" / "models" / "label_map.json"
check("Trained model file exists", model.is_file(), str(model))
try:
    labels = json.loads(labels_path.read_text(encoding="utf-8"))
    check("Label map is valid JSON", isinstance(labels, dict) and bool(labels), f"{len(labels)} labels")
    check("Model label count is 25", len(labels) == 25, f"Found {len(labels)} labels")
except Exception as exc:
    check("Label map is valid JSON", False, str(exc))

for relative in ("backend/app.py", "backend/src/predictor.py"):
    path = ROOT / relative
    try:
        ast.parse(path.read_text(encoding="utf-8"), filename=relative)
        check(f"Python syntax: {relative}", True)
    except Exception as exc:
        check(f"Python syntax: {relative}", False, str(exc))

try:
    package = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))
    version = package.get("dependencies", {}).get("@mediapipe/tasks-vision")
    check("MediaPipe version pinned", version == "0.10.35", str(version))
except Exception as exc:
    check("Frontend package config", False, str(exc))

for name, ok, detail in checks:
    print(f"[{ 'PASS' if ok else 'FAIL' }] {name}" + (f" — {detail}" if detail else ""))
print(f"\n{sum(ok for _, ok, _ in checks)}/{len(checks)} checks passed.")
print("Note: this script checks package structure and syntax, not webcam operation or model accuracy.")
raise SystemExit(0 if all(ok for _, ok, _ in checks) else 1)
