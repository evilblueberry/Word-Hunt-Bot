import unittest

import numpy as np
from modules import find_best_word, rank_words


class FakeDictionary:
    def __init__(self, rows):
        self.rows = rows

    def __getitem__(self, key):
        return [row[key] for row in self.rows]


class SolverTests(unittest.TestCase):
    def test_solver_finds_words_with_adjacent_non_reused_paths(self):
        grid = np.array(list('CATARENSILOPQWER')).reshape(4, 4)
        dictionary = FakeDictionary([
            {'Name': 'cat', 'Value': 100},
            {'Name': 'cart', 'Value': 100},
            {'Name': 'care', 'Value': 100},
            {'Name': 'cater', 'Value': 400},
        ])
        words = dict(find_best_word(grid, dictionary))
        self.assertIn('cat', words)
        for path in words.values():
            self.assertEqual(len(path), len(set(path)))
            self.assertTrue(all(max(abs(a[0] - b[0]), abs(a[1] - b[1])) <= 1 for a, b in zip(path, path[1:])))

    def test_solver_supports_qu_tile(self):
        grid = np.array(['QU', 'I', 'T', 'E', 'A', 'R', 'S', 'N', 'L', 'O', 'P', 'B', 'C', 'D', 'G', 'H']).reshape(4, 4)
        dictionary = FakeDictionary([{'Name': 'quite', 'Value': 400}, {'Name': 'quit', 'Value': 100}])
        words = [word for word, _ in find_best_word(grid, dictionary)]
        self.assertIn('quite', words)

    def test_rank_words_prefers_score_then_length(self):
        dictionary = FakeDictionary([
            {'Name': 'cat', 'Value': 100},
            {'Name': 'cater', 'Value': 400},
            {'Name': 'dog', 'Value': 100},
        ])
        ranked = rank_words([('cat', []), ('dog', []), ('cater', [])], dictionary)
        self.assertEqual([word for word, _ in ranked], ['cater', 'dog', 'cat'])


if __name__ == '__main__':
    unittest.main()
