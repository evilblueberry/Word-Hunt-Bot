import unittest

import numpy as np

from modules import (
    get_board_crop,
    get_grid_geometry,
    grid_cell_centers,
    path_to_coordinates,
    validate_letter_grid,
)


class GeometryTests(unittest.TestCase):
    def test_board_crop_is_validated_against_image_bounds(self):
        self.assertEqual(get_board_crop((2200, 1200, 3)), (150, 1100, 1030, 2000))
        with self.assertRaises(ValueError):
            get_board_crop((1000, 1200, 3))

    def test_grid_geometry_uses_complete_cell_dimensions(self):
        self.assertEqual(get_grid_geometry((900, 880), 4), (220, 225))

    def test_letter_grid_requires_all_cells(self):
        valid = np.array(list("ABCDEFGHIJKLMNOP")).reshape(4, 4)
        np.testing.assert_array_equal(validate_letter_grid(valid, 4), valid)

        invalid = valid.copy()
        invalid[2, 1] = "?"
        with self.assertRaises(ValueError):
            validate_letter_grid(invalid, 4)

    def test_path_coordinates_are_centered_and_validated(self):
        coordinates = path_to_coordinates([(0, 0), (1, 1)], (100, 200), 40, 4)
        self.assertEqual(coordinates, [(120.0, 220.0), (160.0, 260.0)])
        self.assertEqual(len(grid_cell_centers((0, 0), 10, 4)), 4)
        with self.assertRaises(ValueError):
            path_to_coordinates([(0, 0), (0, 0)], (100, 200), 40, 4)
        with self.assertRaises(ValueError):
            path_to_coordinates([(4, 0)], (100, 200), 40, 4)
        with self.assertRaises(ValueError):
            path_to_coordinates([(0, 0), (2, 2)], (100, 200), 40, 4)

    def test_qu_tiles_are_valid_grid_tokens(self):
        valid = np.array(['QU'] + list('BCDEFGHIJKLMNOP')).reshape(4, 4)
        np.testing.assert_array_equal(validate_letter_grid(valid, 4), valid)


if __name__ == "__main__":
    unittest.main()
