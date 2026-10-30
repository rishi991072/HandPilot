# ISLBridge AI — Start Here (Hinglish)

## Pehle ye jaan lo
- Is ZIP mein 25-sign ka trained model hai, 40-sign ka nahi.
- Prediction ko stable banane ke liye recent predictions ka temporal voting add kiya gaya hai. Isse flicker kam hota hai, lekin model ki asli accuracy ki guarantee nahi milti.
- Webcam browser mein MediaPipe se process hota hai. Backend ko alag terminal mein chalu rakhna zaroori hai.
- Virtual keyboard app ke text box mein type karta hai. Cursor Control real Windows mouse ko move/click kar sakta hai.

## Quick package check
Project root folder mein PowerShell se run karo:

```powershell
python .\VERIFY_PROJECT.py
```

Ye model file, label map, MediaPipe version aur Python syntax check karta hai. Ye webcam test ya accuracy test nahi hai.

## Run karne ka tareeka

### Terminal 1 — Backend
PowerShell khol kar project ke `backend` folder mein jao:

```powershell
cd .\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8000
```

Agar activation policy error aaye, sirf current terminal ke liye ye command chalao aur phir activate karo:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Backend check: browser mein `http://127.0.0.1:8000/health` kholo. `translator_model_available: true` dikhna chahiye. Agar `false` aaye to backend terminal mein TensorFlow/model error dekho.

### Terminal 2 — Frontend
Naya PowerShell terminal khol kar project ke `frontend` folder mein jao:

```powershell
cd .\frontend
npm install
npm run dev
```

Browser mein Vite jo localhost address de (usually `http://localhost:5173`) kholo, camera permission Allow karo, phir Start Camera dabao.

## Features ko kaise test karein
1. **Hand tracking:** roshni achhi rakho, haath poora frame mein rakho.
2. **ISL Translator:** 25 supported signs mein se ek sign steady rakho. Stable result aane par hi sentence mein add karo.
3. **Air Drawing:** index finger extend karo; hand camera ke andar rakh kar dheere move karo.
4. **Virtual Keyboard:** Keyboard mode mein camera par dikh rahe key overlay ke upar fingertip le jao, phir thumb-index pinch karke select karo. Text app ke textbox mein hi aayega.
5. **Cursor Control:** pehle desktop par save/close karne layak screen rakho. Point moves the real cursor, pinch clicks, fist sends Enter. Stop Camera to stop gestures.

## Accuracy ke baare mein important note
Model ka output 25 classes ka hai. Confidence threshold aur temporal voting false/random-looking changes ko kam kar sakte hain, lekin sign recognition accuracy ko materially improve karne ke liye training dataset, training preprocessing aur held-out test evaluation ki zaroorat hai. Is package mein original training dataset/preprocessing pipeline included nahi hai, isliye ise honestly “high-accuracy 40-sign translator” nahi kaha ja sakta.
