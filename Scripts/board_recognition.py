"""Detect Word Hunt tiles and recognize their interiors without fixed screen offsets."""

import json
from pathlib import Path

import cv2
import numpy as np


def detect_tiles(image, grid_size=4):
    if image is None:
        raise ValueError('Cannot read screenshot')
    height, width = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    # Wooden tiles are bright and warm; the green board and white score card are excluded.
    mask = cv2.inRange(hsv, (8, 25, 160), (40, 155, 255))
    kernel_size = max(3, round(width / 300))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((kernel_size, kernel_size), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if (0.07 * width < w < 0.26 * width and 0.8 < w / h < 1.2
                and y > 0.2 * height and cv2.contourArea(contour) > 0.65 * w * h):
            boxes.append((x, y, w, h))
    if len(boxes) != grid_size ** 2:
        raise ValueError(f'Expected {grid_size ** 2} wooden tiles; detected {len(boxes)}. Open an unobscured Word Hunt board.')
    boxes.sort(key=lambda box: box[1] + box[3] / 2)
    rows = [sorted(boxes[i:i + grid_size]) for i in range(0, len(boxes), grid_size)]
    sizes = np.array([(box[2], box[3]) for row in rows for box in row])
    if np.max(sizes, axis=0).max() / np.min(sizes, axis=0).min() > 1.2:
        raise ValueError('Detected tile sizes are inconsistent; refusing to guess a grid')
    centers = np.array([[(x + w / 2, y + h / 2) for x, y, w, h in row] for row in rows])
    pitch_x = np.median(np.diff(centers[:, :, 0], axis=1))
    pitch_y = np.median(np.diff(centers[:, :, 1], axis=0))
    if (pitch_x <= 0 or pitch_y <= 0 or abs(pitch_x - pitch_y) > 0.15 * max(pitch_x, pitch_y)
            or np.max(np.abs(centers[:, :, 1] - centers[:, :1, 1])) > 0.1 * pitch_y
            or np.max(np.abs(centers[:, :, 0] - centers[:1, :, 0])) > 0.1 * pitch_x):
        raise ValueError('Detected tiles do not form a regular grid; refusing to swipe')
    return rows


def prepare_letter(image, box):
    x, y, w, h = box
    margin = round(min(w, h) * 0.12)
    gray = cv2.cvtColor(image[y + margin:y + h - margin, x + margin:x + w - margin], cv2.COLOR_BGR2GRAY)
    # Remove wood grain, shadows and rounded tile edges before recognition.
    _, binary = cv2.threshold(gray, 90, 255, cv2.THRESH_BINARY)
    ink = cv2.findNonZero(255 - binary)
    if ink is None:
        raise ValueError('Tile interior contains no letter')
    gx, gy, gw, gh = cv2.boundingRect(ink)
    glyph = binary[gy:gy + gh, gx:gx + gw]
    glyph = cv2.resize(glyph, (round(gw * 96 / gh), 96), interpolation=cv2.INTER_CUBIC)
    return cv2.copyMakeBorder(glyph, 20, 20, 20, 20, cv2.BORDER_CONSTANT, value=255)


def read_board(screenshot_path, reader, grid_size=4, debug_dir=None):
    image = cv2.imread(str(screenshot_path))
    boxes = detect_tiles(image, grid_size)
    letters, details = [], []
    debug_path = Path(debug_dir) if debug_dir else None
    if debug_path:
        debug_path.mkdir(parents=True, exist_ok=True)
    for row_index, row in enumerate(boxes):
        letters.append([])
        for col_index, box in enumerate(row):
            glyph = prepare_letter(image, box)
            # The crop is already a single glyph: bypass EasyOCR's text detector.
            results = reader.recognize(glyph, detail=1, allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ', paragraph=False)
            text = ''.join(result[1] for result in results).upper().strip()
            confidence = min((float(result[2]) for result in results), default=0)
            if confidence < 0.5:
                # Isolated letters can depend on horizontal context; retry with wider margins.
                padded = cv2.copyMakeBorder(glyph, 0, 0, 24, 24, cv2.BORDER_CONSTANT, value=255)
                retry = reader.recognize(padded, detail=1, allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ', paragraph=False)
                retry_confidence = min((float(result[2]) for result in retry), default=0)
                if retry_confidence > confidence:
                    text = ''.join(result[1] for result in retry).upper().strip()
                    confidence = retry_confidence
            valid = (len(text) == 1 and text in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') or text == 'QU'
            letters[-1].append(text if valid and confidence >= 0.5 else '?')
            details.append({'row': row_index, 'col': col_index, 'text': text, 'confidence': confidence, 'box': box})
            if debug_path:
                cv2.imwrite(str(debug_path / f'cell_{row_index}_{col_index}.png'), glyph)
                x, y, w, h = box
                cv2.rectangle(image, (x, y), (x + w, y + h), (0, 0, 255), 3)
                cv2.circle(image, (round(x + w / 2), round(y + h / 2)), 6, (255, 0, 0), -1)
                cv2.putText(image, f'{text} {confidence:.2f}', (x, y - 6),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
    if debug_path:
        cv2.imwrite(str(debug_path / 'board_overlay.png'), image)
        (debug_path / 'recognition.json').write_text(json.dumps(details, indent=2))
    grid = np.array(letters)
    if '?' in grid:
        raise ValueError(f'Uncertain OCR; no swipes sent. Grid: {grid.tolist()}. See {debug_dir} for cell crops/confidences.')
    return grid, boxes


def screen_geometry(boxes, screenshot_size, screen_size):
    """Map detected centers into device points using both screenshot scale factors."""
    sx, sy = screen_size['width'] / screenshot_size[0], screen_size['height'] / screenshot_size[1]
    return [[((x + w / 2) * sx, (y + h / 2) * sy) for x, y, w, h in row] for row in boxes]
