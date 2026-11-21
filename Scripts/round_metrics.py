"""Round measurements; game counters, never HTTP success, establish acceptance."""
import json
import re
import time
import statistics
from datetime import datetime, timezone
from pathlib import Path

import cv2


class RoundMetrics:
    def __init__(self, output, preset='safe', label='baseline'):
        self.output = Path(output) / 'runs' / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ') + '-' + label)
        self.output.mkdir(parents=True, exist_ok=True)
        self.started = time.perf_counter()
        self.data = {'preset': preset, 'label': label, 'stages_s': {}, 'swipes': [], 'accepted': None, 'score': None, 'status': 'running'}
        self.flush()

    def flush(self):
        (self.output / 'timing.json').write_text(json.dumps(self.data, indent=2))

    def finish(self, status='complete'):
        self.data['status'] = status
        self.data['total_s'] = time.perf_counter() - self.started
        self.data['attempted'] = sum(row.get('word_count', 1) for row in self.data['swipes'])
        if self.data['accepted'] is not None and self.data['attempted']:
            self.data['acceptance_rate'] = self.data['accepted'] / self.data['attempted']
        self.flush()
        summary={key:value for key,value in self.data.items() if key not in ('swipes','tuning','before','after','execution_tuning')}
        if self.data['swipes']:
            summary['mean_request_s']=statistics.mean(row['duration_s'] for row in self.data['swipes'])
            summary['mean_gap_s']=statistics.mean(row['gap_s'] for row in self.data['swipes'])
        print('ROUND REPORT ' + json.dumps(summary), flush=True)
        print(f'Timing and screenshots: {self.output}', flush=True)


def read_counters(path, reader):
    image = cv2.imread(str(path))
    if image is None:
        return {'words': None, 'score': None, 'raw': []}
    height, width = image.shape[:2]
    # Score panel remains above the board; OCR only these two printed lines.
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, (0, 0, 195), (180, 45, 255))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    panels = [cv2.boundingRect(c) for c in contours]
    panels = [(x,y,w,h) for x,y,w,h in panels if w > .6 * width and .05 * height < h < .2 * height and y < .2 * height]
    raw = []
    if len(panels) != 1:
        return {'words': None, 'score': None, 'raw': raw}
    x,y,w,h = panels[0]
    for top,bottom in [(0.23,0.44),(0.44,0.75)]:
        crop = image[y+int(h*top):y+int(h*bottom), x+int(w*.28):x+int(w*.97)]
        result = reader.recognize(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), detail=1, allowlist='WORDSCE:0123456789', paragraph=False)
        raw.append({'text': ''.join(r[1] for r in result), 'confidence': min((float(r[2]) for r in result), default=0)})
    def number(index, keyword):
        row = raw[index]
        # O/0 is ambiguous in this font; only the numeric suffix may be normalized.
        digits = re.search(r'([0-9O]+)$', row['text'])
        return int(digits[1].replace('O', '0')) if keyword in row['text'] and digits and row['confidence'] >= .5 else None
    return {'words': number(0, 'WORDS'), 'score': number(1, 'SCORE'), 'raw': raw}
