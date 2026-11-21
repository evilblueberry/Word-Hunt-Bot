import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from image_recognition import find_button_location


class ImageRecognitionTests(unittest.TestCase):
    def test_button_match_returns_center(self):
        screenshot = np.zeros((120, 160), dtype=np.uint8)
        button = np.zeros((20, 30), dtype=np.uint8)
        button[4:16, 5:25] = 180
        button[8:12, 10:20] = 255
        screenshot[40:60, 70:100] = button

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            screenshot_path = root / "screen.png"
            button_path = root / "button.png"
            cv2.imwrite(str(screenshot_path), screenshot)
            cv2.imwrite(str(button_path), button)

            self.assertEqual(find_button_location(str(screenshot_path), str(button_path)), (85, 50))

    def test_button_match_rejects_low_confidence(self):
        screenshot = np.zeros((120, 160), dtype=np.uint8)
        button = np.zeros((20, 30), dtype=np.uint8)
        button[4:16, 5:25] = 180
        button[8:12, 10:20] = 255

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            screenshot_path = root / "screen.png"
            button_path = root / "button.png"
            cv2.imwrite(str(screenshot_path), screenshot)
            cv2.imwrite(str(button_path), button)

            with self.assertRaises(ValueError):
                find_button_location(str(screenshot_path), str(button_path))


if __name__ == "__main__":
    unittest.main()
