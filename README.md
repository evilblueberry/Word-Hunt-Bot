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
- **Tesseract OCR** (optional, for extracting letters from screenshots)

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

1. **Install dependencies**
   ```bash
   pip install opencv-python pillow selenium appium-python-client
2. Start appium
   ```bash
   appium
3. Connect your iPhone
- Enable developer mode.
- Connect via USB or Wi-Fi.
- Ensure WebDriverAgent is installed and running.
4. Run the bot
  ```bash
   python main.py



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





