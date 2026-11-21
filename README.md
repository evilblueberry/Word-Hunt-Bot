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

### Apple signing values

For this Personal Team, the current Team ID is `287MYRCJ37`. The certificate display may contain another 10-character value in parentheses; that is the certificate identifier, not the Team ID. The launcher uses `Apple Development` as the signing identity and derives/validates the Team ID from the certificate's `OU` field.

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
   npm install --save-exact appium@4.0.0
   npx appium driver install xcuitest@13.5.0
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

### Validation

Run the deterministic checks before testing on a phone:

```bash
PYTHONPATH=Scripts python3 -m unittest discover -s Scripts/tests -t . -v
cd launcher && npm run lint && npm run build
```

The repository tests validate image-match safety, OCR-grid validation, board geometry,
and swipe coordinate generation. A real iPhone is still required for WDA signing and
end-to-end gameplay validation.

### Board recognition and diagnostics

The bot detects 16 wooden tiles in a regular grid, reads their letter interiors using
EasyOCR, and maps their detected centers from screenshot pixels into device points.
It no longer relies on a fixed screenshot crop or a separate hard-coded swipe origin.
OCR loads before the timed round starts. If a board is already visible, Start is skipped.
Uncertain letters stop execution before swiping.

The launcher runtime's `output/ocr_debug` folder contains a labeled `board_overlay.png`,
16 prepared cell images, and `recognition.json` with letter confidences. `output/swipe_plan.json`
contains the recognized words, paths, and device coordinates. `Scripts/main.py --dry-run`
requires a visible board and saves the plan without tapping Start or sending swipes.
Run tests with the Python environment containing EasyOCR, for example:

```bash
PYTHONPATH=Scripts "$HOME/Library/Application Support/launcher/runtime/venv/bin/python" -m unittest discover -s Scripts/tests -t . -v
```

### Current launcher speed mode

The launcher defaults to **Fast — all words, 155 / 60 ms**. It uses the measured
screen-coordinate WDA mode: one request containing all words that fit the remaining
round budget, a 155 ms path, 10 ms press/release dwells, and 60 ms between words.
Safe preserves the original 250 ms per-tile Selenium gesture timings. Max is disabled
pending calibration. Every run prints the actual mode/settings in the live console.

The latest live Fast test accepted 123/126 words (97.62%), scored 41,773, and took
27.99 seconds for the measured round segment. The user requested this exact tested
mode in the launcher and waived the proposed five-round stability check. It is
enabled without claiming that stability check was completed.

Fast installs the reversible WDA helper if needed, retaining a `.wordhunt-original`
source backup. It rebuilds WDA only if the helper source needs installing/updating.
Keep the phone on the Start screen while this first-time build completes.

To load source updates, fully quit the old launcher, stop its development server
with Ctrl+C, then run:

```bash
cd "/Users/malcolm/Antigravity Projects/Word-Hunt-Bot/launcher"
npm run dev
```

The updated window title is **Word Hunt Bot — All Words**. An installed `.app` or
DMG does not update from repository edits; use the development command above or
rebuild a distribution with `npm run dist`.


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


