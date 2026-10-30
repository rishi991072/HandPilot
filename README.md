# HandPilot

### An Intelligent Hand Gesture-Based Computer Interaction and Sign Language Translation System

**Translate Signs. Control Your Digital World with Your Hands.**

HandPilot is a computer vision-based application that combines **React, MediaPipe, FastAPI, and a trained LSTM model** to enable hand gesture recognition and gesture-based computer interaction through a webcam.

It provides four interactive modes: ISL Sign Translator, Cursor Control, Air Drawing, and Virtual Keyboard.

---

## 📌 Table of Contents

- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Trained Machine Learning Model](#-trained-machine-learning-model)
- [Installation and Setup](#-installation-and-setup)
- [How to Use](#-how-to-use)
- [API Health Check](#-api-health-check)
- [Troubleshooting](#-troubleshooting)
- [Privacy and Safety](#-privacy-and-safety)
- [Limitations](#-limitations)
- [Future Enhancements](#-future-enhancements)

---

## 🚀 Features

### 1. ISL Sign Translator
- Detects hand landmarks using MediaPipe.
- Processes normalized sequences of 30 frames.
- Uses a trained 25-class LSTM model to predict supported signs.
- Applies a confidence threshold to help filter uncertain predictions.
- Supports adding recognized signs to a sentence.

### 2. Cursor Control
- Move the desktop cursor using your index finger.
- Use a pinch gesture to click.
- Use a fist gesture to press Enter.
- Designed for hands-free desktop interaction.

**Note:** Cursor Control operates the computer running the backend. Use it carefully and stop the camera when finished.

### 3. Air Drawing
- Draw using your index finger in the live camera view.
- Choose colors and brush sizes.
- Use the eraser and clear controls.
- Continue creating drawings using hand gestures.

### 4. Virtual Keyboard
- Type using the on-screen keyboard.
- Select keys using camera-based pointing and pinch gestures.
- Keep typed text within the HandPilot application.

The virtual keyboard does not enable system-wide typing in other applications.

---

## 🏗️ System Architecture

The following diagram illustrates how the main components interact.

![HandPilot System Architecture](docs/architecture.svg)

**Processing flow:**

1. The webcam captures the user's hand movements.
2. MediaPipe detects and tracks hand landmarks in the browser.
3. The frontend processes the landmark data for the selected mode.
4. In Translator mode, a normalized sequence of 30 frames and 126 features per frame is sent to the FastAPI backend.
5. The backend loads the trained LSTM model and predicts a supported sign.
6. The prediction is returned to the frontend and displayed to the user.

Cursor Control, Air Drawing, and Virtual Keyboard use their respective gesture-interaction logic.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React.js | Interactive frontend |
| Vite | Frontend development server and build tool |
| JavaScript | Frontend logic and gesture interactions |
| MediaPipe | Hand landmark detection and tracking |
| Python | Backend and machine learning |
| FastAPI | Backend API |
| TensorFlow / Keras | Loading and running the trained LSTM model |
| NumPy | Numerical processing of landmark sequences |
| PyAutoGUI | Desktop cursor and keyboard actions |
| Git and GitHub | Version control and project hosting |

---

## 📂 Project Structure

```text
HandPilot/
├── README.md
├── .gitignore
├── START_HERE_HINGLISH.md
├── VERIFY_PROJECT.py
│
├── docs/
│   └── architecture.svg
│
├── frontend/
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── style.css
│
└── backend/
    ├── app.py
    ├── requirements.txt
    ├── src/
    │   └── predictor.py
    └── models/
        ├── isl_lstm_25_signs_best.keras
        └── label_map.json
```

*The structure above describes the expected contents of the packaged project. Check the actual repository if any listed file is absent.*

---

## 🧠 Trained Machine Learning Model

HandPilot includes a trained LSTM model for sign classification.

**Model details:**

- **Model file:** `isl_lstm_25_signs_best.keras`
- **Label map:** `label_map.json`
- **Prediction module:** `backend/src/predictor.py`
- **Number of classes:** 25
- **Expected input:** 30 frames × 126 features
- **Default confidence threshold:** 70%

The predictor returns `Unknown` when its confidence is below the default threshold.

### Model Performance

The previously recorded test result was **78.33% on a test set of 60 samples**. Since this is a small test set, the result should not be interpreted as a reliable estimate of real-world performance.

The bundled model supports 25 classes, not 40. Supporting additional signs requires a compatible model trained and evaluated on the corresponding classes using the same landmark preprocessing pipeline.

---

## ⚙️ Installation and Setup

### Prerequisites

Install the following before starting:

- Windows 10 or Windows 11
- Python 3.10–3.12, subject to compatibility with the installed TensorFlow version
- Node.js 18 or later
- npm
- A webcam
- Git (optional for local execution, required for Git-based version control)

An internet connection is needed on the first camera startup if the application downloads MediaPipe resources.

### Step 1: Clone the Repository

Replace `YOUR_USERNAME` with your GitHub username.

```bash
git clone https://github.com/YOUR_USERNAME/HandPilot.git
cd HandPilot
```

Alternatively, download the repository ZIP from GitHub and extract it.

### Step 2: Set Up the Backend

Open a terminal in the project root and run:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Start the FastAPI server:

```powershell
python -m uvicorn app:app --reload --port 8000
```

The backend should be available at:

`http://127.0.0.1:8000`

Keep this terminal running.

### Step 3: Set Up the Frontend

Open a **second terminal** in VS Code.

From the project root, run:

```powershell
cd frontend
npm install
npm run dev
```

Vite will display the local development URL. The default is usually:

`http://localhost:5173`

Open that address in your browser and allow webcam access when prompted.

---

## 🖐️ How to Use

### ISL Sign Translator
1. Start the backend and frontend.
2. Select Translator mode.
3. Click **Start Camera** and grant permission.
4. Show a supported sign clearly within the camera frame.
5. Wait for the prediction.
6. Use **Add sign to sentence** if you want to add the current prediction to the sentence.

### Cursor Control
1. Select Cursor Control mode.
2. Start the camera.
3. Point your index finger to move the cursor.
4. Use a pinch gesture to click.
5. Use a fist gesture to press Enter.

Test carefully. Stop the camera when you no longer need cursor control.

### Air Drawing
1. Select Air Drawing mode.
2. Start the camera.
3. Extend your index finger to draw.
4. Use the available controls to change the color, adjust brush size, erase, or clear the drawing.

### Virtual Keyboard
1. Select Virtual Keyboard mode.
2. Start the camera if you want to use gesture-based selection.
3. Click the on-screen keys or point and pinch to select a key.
4. Your text remains within the HandPilot page.

---

## 🔍 API Health Check

With the backend running, open:

`http://127.0.0.1:8000/health`

A healthy response should indicate that the model file exists and the translator model is available.

For example, check for:

```json
{
  "model_file_present": true,
  "translator_model_available": true
}
```

This is an illustrative example; the actual response may include additional fields.

If `translator_model_available` is false, inspect the backend terminal for TensorFlow import errors and confirm that the model file is present.

---

## 🧰 Troubleshooting

### TensorFlow installation fails
Use a Python version compatible with the TensorFlow release and your Windows environment. Create a fresh virtual environment and reinstall the backend requirements.

### Translator model is unavailable
- Confirm that `backend/models/isl_lstm_25_signs_best.keras` exists.
- Check that `backend/models/label_map.json` exists.
- Inspect the backend terminal for TensorFlow or model-loading errors.

### Sign predictions are unstable
- Keep the hand clearly visible.
- Avoid rapid movements and hand occlusion.
- Ensure sufficient lighting.
- Remember that the confidence threshold filters uncertain predictions but does not improve the model's underlying accuracy.

### Camera does not start
- Open the frontend through `http://localhost:5173`.
- Allow camera permission in your browser.
- Check whether another application is using the webcam.
- Check the browser console for errors.

### Backend is offline
- Make sure the backend terminal is still running.
- Open the health-check endpoint.
- Confirm that the frontend is configured to use the correct backend address.

### Cursor Control does not work
- Run the backend in the same interactive desktop session as the computer you want to control.
- Check that PyAutoGUI is installed.
- Verify that the operating system permits the required interaction.

---

## 🔐 Privacy and Safety

- MediaPipe hand landmark detection runs in the browser.
- Translator mode sends landmark feature arrays to the local FastAPI backend, rather than sending the camera video itself.
- Cursor Control can move the real mouse and perform actions on the computer running the backend.
- Stop the camera when finished using gesture controls.
- Do not use the application as a substitute for a qualified sign-language interpreter in important medical, legal, or emergency situations.

---

## ⚠️ Limitations

- The bundled model supports 25 sign classes.
- The recorded test result is based on a small test set and does not guarantee real-world accuracy.
- Performance can vary with lighting, camera quality, hand position, occlusion, and movement speed.
- The application recognizes only signs represented by its trained classes.
- Cursor Control operates the backend host computer, not automatically the remote visitor's computer when the backend is deployed to a cloud server.
- The virtual keyboard keeps text inside the application; it does not provide system-wide typing.

---

## 🔮 Future Enhancements

Potential improvements include:

- Expanding and validating the sign dataset.
- Training and evaluating a larger sign vocabulary.
- Improving temporal gesture recognition and prediction stability.
- Adding multilingual text and speech output.
- Improving accessibility and interface customization.
- Adding more systematic performance and usability tests.

---

## 👨‍💻 Project Information

**Project:** HandPilot  
**Category:** Computer Vision, Machine Learning, and Human–Computer Interaction  
**Primary Technologies:** React, MediaPipe, Python, FastAPI, TensorFlow/Keras

**Tagline:** *Translate Signs. Control Your Digital World with Your Hands.*

---

*HandPilot is a gesture-interaction and sign-classification project. Its performance depends on the trained model, input quality, and runtime environment.*