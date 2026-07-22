# Word Hunt Automation Bot

## Overview
This project automates playing the **Word Hunt** game in iMessage using Python, Appium, and computer vision. It captures the game board, identifies word paths, and performs swipe gestures on the screen to automatically play them. The project handles challenges such as dynamic letter placement and popup overlays by combining Appium automation with OpenCV image recognition.

---

## Features
- Screenshot capture of the game board during play.
- Board detection using OpenCV template matching and ORB feature detection.
- Swipe simulation with Selenium’s `ActionBuilder` for touch input.
- Coordinate scaling to map screenshot pixels to device coordinates.
- Overlay handling for popups (e.g., "Start" button) via image-based tapping.

---

## Tech Stack
- **Python 3.x**
- **Appium** for iOS automation
- **Selenium (ActionBuilder)** for touch gestures
- **OpenCV** for image recognition
- **Pillow (PIL)** for image processing
- **Tesseract OCR** (legacy optional; the current launcher path uses EasyOCR directly)

---

## Project Structure
├── images/ # Reference images (board edges, start button, etc.)
├── main.py # Entry point for automation
├── swipe.py # Swipe gesture logic (swipe_word function)
├── vision.py # Image recognition (template matching, ORB detection)
├── utils/ # Helper functions
└── README.md # Project documentation



---

## Setup & Installation

### Launcher flow

The launcher now installs an isolated runtime instead of depending on global Appium setup:

1. Open the launcher.
2. Go to the **Dependencies** view.
3. Click **Install dependencies**.
4. Enter your **UDID**, **Apple Team ID**, and **updated WDA bundle ID**.
5. Run the built-in **WDA test**.
6. Move to **Run Bot** and click **Run bot**.

### Manual CLI flow

1. Install Python dependencies:
   ```bash
   python3 -m venv venv
   ./venv/bin/python -m pip install --upgrade pip setuptools wheel
   ./venv/bin/python -m pip install -r requirements.txt
   ```
2. Install Appium and the XCUITest driver locally:
   ```bash
   mkdir -p .runtime/appium
   cd .runtime/appium
   npm init -y
   npm install --save-exact appium appium-xcuitest-driver
   npx appium server --use-drivers=xcuitest
   ```
3. Connect your iPhone:
   - Enable Developer Mode.
   - Connect via USB or Wi-Fi.
   - Make sure Xcode can see the device.
4. Run the bot:
   ```bash
   BOT_UDID=<your-udid> ./venv/bin/python Scripts/main.py
   ```


How It Works
1. Board Detection
- Captures a screenshot of the device screen.
- Uses ORB feature matching to locate the board’s top-left corner.
- Adapts dynamically to overlays and different screen resolutions.
2. Word Path Conversion
- Word paths are pre-calculated or extracted from a dictionary.
- Each path is mapped into screen coordinates using the detected grid position and cell size.
3. Swipe Simulation
- Performs a press at the starting letter.
- Moves smoothly across the word path with ActionBuilder.
- Releases the touch at the end of the word.
4. Overlay Handling
- Detects UI overlays (such as the "Start" button) by template matching.
- Taps at the correct scaled coordinates to dismiss them before gameplay.




