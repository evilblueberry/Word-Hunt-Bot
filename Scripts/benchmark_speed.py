"""Reproducible offline measurements; never claims game acceptance."""
import argparse
import json
import statistics
import time
from pathlib import Path

import numpy as np

from dictionaries import temp_dictionary, word_dictionary
from modules import find_best_word, get_ocr_reader
from board_recognition import read_board
from trie_solver import TrieSolver


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=Path('tests/output/speed/offline.json'))
    args=parser.parse_args()
    started=time.perf_counter()
    reader=get_ocr_reader()
    load_s=time.perf_counter()-started
    started=time.perf_counter()
    solver=TrieSolver(word_dictionary['Name'])
    build_s=time.perf_counter()-started
    results=[]
    for name,expected in [('ios26_board.png',['SOOA','PSNE','RCUE','AHHR']),('legacy_board.png',['ITCU','EHEF','ICFT','SALL'])]:
        records=[]
        for _ in range(5):
            started=time.perf_counter()
            grid,_=read_board(Path(__file__).parent/'tests'/'fixtures'/name,reader)
            ocr_s=time.perf_counter()-started
            assert [''.join(row) for row in grid]==expected
            started=time.perf_counter()
            legacy=find_best_word(grid,temp_dictionary(set(''.join(grid.flat).lower())))
            legacy_s=time.perf_counter()-started
            started=time.perf_counter()
            trie=solver.solve(grid)
            trie_s=time.perf_counter()-started
            assert {word for word,_ in legacy}=={word for word,_ in trie}
            records.append({'ocr_s':ocr_s,'legacy_s':legacy_s,'trie_s':trie_s,'words':len(trie)})
        results.append({'fixture':name,'records':records,'means':{key:statistics.mean(r[key] for r in records) for key in ('ocr_s','legacy_s','trie_s')}})
    data={'kind':'offline','reader_load_s':load_s,'trie_build_s':build_s,'results':results}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,indent=2))
    print(json.dumps(data,indent=2))


if __name__=='__main__':
    main()
