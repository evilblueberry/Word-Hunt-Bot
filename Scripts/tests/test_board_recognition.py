import unittest
from pathlib import Path

import cv2
import easyocr
import numpy as np

from board_recognition import detect_tiles, read_board, screen_geometry

FIXTURES = Path(__file__).parent / 'fixtures'


class BoardRecognitionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reader = easyocr.Reader(['en'], gpu=False)

    def test_real_boards_have_exact_expected_letters(self):
        for name, expected in [
            ('ios26_board.png', ['SOOA', 'PSNE', 'RCUE', 'AHHR']),
            ('legacy_board.png', ['ITCU', 'EHEF', 'ICFT', 'SALL']),
        ]:
            with self.subTest(name=name):
                grid, _ = read_board(FIXTURES / name, self.reader)
                self.assertEqual([''.join(row) for row in grid], expected)

    def test_scaled_screenshot_retains_letters_and_touch_centers(self):
        import tempfile
        image = cv2.imread(str(FIXTURES / 'ios26_board.png'))
        scaled = cv2.resize(image, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'scaled.png'
            cv2.imwrite(str(path), scaled)
            grid, boxes = read_board(path, self.reader)
            self.assertEqual([''.join(row) for row in grid], ['SOOA', 'PSNE', 'RCUE', 'AHHR'])
            centers = screen_geometry(boxes, (scaled.shape[1], scaled.shape[0]), {'width': 393, 'height': 852})
            np.testing.assert_allclose(centers[0][0], (90, 416.5), atol=1)

    def test_rejects_missing_board_and_start_screen(self):
        with self.assertRaisesRegex(ValueError, 'detected 0'):
            detect_tiles(np.zeros((852, 393, 3), np.uint8))
        with self.assertRaises(ValueError):
            detect_tiles(cv2.imread(str(FIXTURES / 'start_screen.png')))


if __name__ == '__main__':
    unittest.main()
