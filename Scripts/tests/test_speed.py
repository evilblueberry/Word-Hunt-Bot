import json
import unittest

import numpy as np
from selenium.webdriver.common.actions.action_builder import ActionBuilder
from selenium.webdriver.common.actions.pointer_input import PointerInput
from selenium.webdriver.common.actions.interaction import POINTER_TOUCH

from dictionaries import words, temp_dictionary
from modules import find_best_word, path_to_coordinates
from speed import build_batches, load_preset, word_actions
from trie_solver import TrieSolver


class SpeedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.solver = TrieSolver(words)

    def test_trie_matches_legacy_and_all_paths_are_valid(self):
        boards = [np.array(list(s)).reshape(4,4) for s in ['SOOAPSNERCUEAHHR', 'ITCUEHEFICFTSALL', 'LTNMIIMEIYSAHTFC']]
        boards.append(np.array(['QU','I','T','E','A','R','S','N','L','O','P','B','C','D','G','H']).reshape(4,4))
        for board in boards:
            old = find_best_word(board, temp_dictionary(set(''.join(board.flat).lower())))
            actual = self.solver.solve(board)
            self.assertEqual({word for word,_ in old}, {word for word,_ in actual})
            for word,path in actual:
                path_to_coordinates(path,(0,0),1,4)
                self.assertEqual(''.join(board[r,c] for r,c in path).lower(), word)

    def test_safe_encodes_original_selenium_actions(self):
        _,safe,_ = load_preset('safe')
        centers = [[(c*30+15,r*30+15) for c in range(4)] for r in range(4)]
        path = [(0,0),(1,1),(1,2)]
        pointer = PointerInput(POINTER_TOUCH,'touch')
        actions = ActionBuilder(None,mouse=pointer)
        actions.pointer_action.move_to_location(*centers[0][0])
        actions.pointer_action.pointer_down()
        actions.pointer_action.move_to_location(*centers[1][1])
        actions.pointer_action.move_to_location(*centers[1][2])
        actions.pointer_action.pointer_up()
        self.assertEqual(word_actions(path,centers,safe),pointer.encode()['actions'])

    def test_launcher_fast_uses_latest_all_words_settings(self):
        name,tuning,fallback=load_preset('fast')
        self.assertEqual(name,'fast')
        self.assertFalse(fallback)
        self.assertEqual(tuning['swipe_ms'],155)
        self.assertEqual(tuning['gap_ms'],60)
        self.assertEqual(tuning['batch_size'],'all')
        self.assertEqual(tuning['transport'],'wda-screen')
        self.assertEqual(tuning['solver'],'legacy')

    def test_batch_releases_between_words_and_keeps_timing(self):
        _,fast,_ = load_preset('fast',experimental=True)
        fast['batch_size'] = 2
        fast['intermediate_points'] = 2
        centers = [[(c*30+15,r*30+15) for c in range(4)] for r in range(4)]
        batch = build_batches([('cat',[(0,0),(0,1),(1,1)]),('car',[(0,0),(0,1),(1,2)])],centers,fast)[0]
        actions = batch['payload']['actions'][0]['actions']
        self.assertEqual(sum(a['type']=='pointerDown' for a in actions),2)
        self.assertEqual(sum(a['type']=='pointerUp' for a in actions),2)
        self.assertEqual(sum(a['duration'] for a in actions if a['type']=='pointerMove'),2*fast['swipe_ms'])
        self.assertEqual(batch['requested_ms'],2*(fast['swipe_ms']+fast['press_ms']+fast['release_ms'])+fast['gap_ms'])
        json.dumps(batch)

    def test_invalid_paths_and_tuning_are_blocked(self):
        _,safe,_ = load_preset('safe')
        centers = [[(c,r) for c in range(4)] for r in range(4)]
        for path in [[(0,0),(2,2)],[(0,0),(0,0)],[(4,0)]]:
            with self.assertRaises(ValueError):
                word_actions(path,centers,safe)
        for value in [-1,float('nan')]:
            with self.assertRaises(ValueError):
                build_batches([('a',[(0,0)])],centers,{**safe,'swipe_ms':value})

    def test_all_words_request_has_gap_after_every_lift_and_respects_budget(self):
        _,fast,_=load_preset('fast',experimental=True)
        tuning={**fast,'batch_size':'all','gap_ms':60,'swipe_ms':155}
        centers=[[(c*30+15,r*30+15) for c in range(4)] for r in range(4)]
        words=[('cat',[(0,0),(0,1),(1,1)]),('car',[(0,0),(0,1),(1,2)]),('rat',[(1,2),(1,1),(0,1)])]
        batches=build_batches(words,centers,tuning)
        self.assertEqual(len(batches),1)
        self.assertEqual(batches[0]['words'],['cat','car','rat'])
        actions=batches[0]['payload']['actions'][0]['actions']
        ups=[i for i,a in enumerate(actions) if a['type']=='pointerUp']
        for i in ups[:-1]:
            self.assertEqual(actions[i+1],{'type':'pause','duration':60})
        clipped=build_batches(words,centers,tuning,max_timeline_ms=410)
        self.assertEqual(clipped[0]['words'],['cat','car'])
        self.assertLessEqual(clipped[0]['requested_ms'],410)


if __name__=='__main__':
    unittest.main()
