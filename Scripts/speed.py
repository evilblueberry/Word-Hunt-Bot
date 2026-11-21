"""Explicit, reproducible gesture plans and timed execution."""
import copy
import hashlib
import json
import math
import urllib3
from pathlib import Path

from selenium.webdriver.remote.command import Command

from modules import path_to_coordinates

CONFIG_PATH = Path(__file__).resolve().parent.parent / 'speed_config.json'


def load_preset(name=None, experimental=False):
    config = json.loads(CONFIG_PATH.read_text())
    name = name or config['default']
    if name not in config['presets']:
        raise ValueError(f'Unknown speed preset: {name}')
    requested = copy.deepcopy(config['presets'][name])
    # Promotion is a separate step after live baseline/sweep/stability reports.
    verified = requested.get('live_verified', False) or requested.get('launcher_enabled', False)
    effective = requested if name == 'safe' or experimental or verified else copy.deepcopy(config['presets']['safe'])
    validate_tuning(effective)
    return name, effective, name != 'safe' and not experimental and not verified


def validate_tuning(tuning):
    for key in ('swipe_ms', 'reposition_ms', 'press_ms', 'release_ms', 'gap_ms'):
        value = tuning[key]
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError(f'{key} must be finite and nonnegative')
    for key in ('batch_size', 'intermediate_points'):
        if key=='batch_size' and tuning[key]=='all':
            continue
        if not isinstance(tuning[key], int) or tuning[key] < (1 if key == 'batch_size' else 0):
            raise ValueError(f'Invalid {key}')
    if tuning['duration_mode'] not in ('per_tile', 'whole_path'):
        raise ValueError('Unknown duration_mode')


def fingerprint(tuning):
    # Validation metadata cannot change the identity of the actual execution settings.
    settings={key:value for key,value in tuning.items() if key not in ('description','live_verified','validation','launcher_enabled')}
    return hashlib.sha256(json.dumps(settings, sort_keys=True).encode()).hexdigest()


def word_actions(path, centers, tuning):
    path_to_coordinates(path, (0,0), 1, len(centers))
    coordinates = [(round(centers[r][c][0]), round(centers[r][c][1])) for r,c in path]
    def move(point, duration):
        return {'type': 'pointerMove', 'duration': duration, 'x': point[0], 'y': point[1], 'origin': 'viewport'}
    actions = [move(coordinates[0], round(tuning['reposition_ms'])), {'type':'pointerDown', 'button':0, 'duration':0}]
    if tuning['press_ms']:
        actions.append({'type':'pause','duration':round(tuning['press_ms'])})
    steps = (len(coordinates)-1) * (tuning['intermediate_points']+1)
    total = round(tuning['swipe_ms']) * (len(coordinates)-1) if tuning['duration_mode']=='per_tile' else round(tuning['swipe_ms'])
    index = 0
    for a,b in zip(coordinates, coordinates[1:]):
        for part in range(1,tuning['intermediate_points']+2):
            point = tuple(round(a[i]+(b[i]-a[i])*part/(tuning['intermediate_points']+1)) for i in range(2))
            duration = round(total*(index+1)/steps) - round(total*index/steps)
            actions.append(move(point, duration))
            index += 1
    if tuning['release_ms']:
        actions.append({'type':'pause','duration':round(tuning['release_ms'])})
    actions.append({'type':'pointerUp','button':0,'duration':0})
    return actions


def build_batches(words, centers, tuning, max_timeline_ms=None):
    validate_tuning(tuning)
    if tuning['batch_size']=='all' and max_timeline_ms is not None:
        elapsed=0
        selected=[]
        for word,path in words:
            duration=sum(item.get('duration',0) for item in word_actions(path,centers,tuning))
            duration+=tuning['gap_ms'] if selected else 0
            if elapsed+duration>max_timeline_ms:
                break
            elapsed+=duration
            selected.append((word,path))
        words=selected
    size=max(1,len(words)) if tuning['batch_size']=='all' else tuning['batch_size']
    batches = []
    for offset in range(0, len(words), size):
        group = words[offset:offset+size]
        actions = []
        word_timings=[]
        timeline=0
        for index,(word,path) in enumerate(group):
            if (index or offset) and tuning['gap_ms']:
                actions.append({'type':'pause','duration':round(tuning['gap_ms'])})
                timeline+=round(tuning['gap_ms'])
            word_path_actions=word_actions(path,centers,tuning)
            duration=sum(action.get('duration',0) for action in word_path_actions)
            word_timings.append({'word':word,'requested_start_ms':timeline,'requested_duration_ms':duration})
            timeline+=duration
            actions.extend(word_path_actions)
        batches.append({'words':[word for word,_ in group], 'payload':{'actions':[{'type':'pointer',
                        'id':'touch', 'parameters':{'pointerType':'touch'}, 'actions':actions}]},
                        'requested_ms':sum(a.get('duration',0) for a in actions),'word_timings':word_timings})
    return batches


def send_batch(driver, batch):
    # One synchronous request per batch; same finger, release between words.
    return driver.execute(Command.W3C_ACTIONS, batch['payload'])


class DirectWDA:
    """Use the existing WDA session and forwarded port; never create a second session."""
    def __init__(self, url='http://127.0.0.1:8100', screen_coordinates=False):
        from urllib.parse import urlparse
        if urlparse(url).hostname not in ('127.0.0.1','localhost'):
            raise ValueError('WDA gesture transport requires a loopback forwarded port')
        self.url=url.rstrip('/')
        self.screen_coordinates=screen_coordinates
        self.pool=urllib3.PoolManager(maxsize=1, retries=False, timeout=urllib3.Timeout(connect=5,read=120))
        response=self.pool.request('GET',self.url+'/status')
        status=json.loads(response.data)
        self.session_id=status.get('sessionId')
        if response.status!=200 or not self.session_id:
            raise RuntimeError('No active WDA session on forwarded port 8100')

    def send(self,batch):
        payload=dict(batch['payload'])
        if self.screen_coordinates:
            payload['wordHuntScreenCoordinates']=True
            payload['wordHuntViewport']=batch['viewport']
        response=self.pool.request('POST',f'{self.url}/session/{self.session_id}/actions',
                                   body=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
        result=json.loads(response.data)
        if response.status!=200 or isinstance(result.get('value'),dict) and result['value'].get('error'):
            raise RuntimeError(f'WDA action failed ({response.status}): {result}')
        value=result.get('value') or {}
        if self.screen_coordinates and (not isinstance(value,dict) or value.get('wordHuntScreenCoordinates') is not True):
            raise RuntimeError('WDA did not acknowledge the opt-in screen-coordinate implementation; experiment invalid')
        return result

    def close(self):
        self.pool.clear()
