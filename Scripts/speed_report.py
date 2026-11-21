"""Summarize measured rounds without treating missing counters as passes."""
import argparse
import json
import statistics
from pathlib import Path

from speed import CONFIG_PATH, fingerprint


def reports(root):
    rows=[]
    for path in sorted(Path(root).glob('*/timing.json')):
        row=json.loads(path.read_text())
        note=path.parent/'measurement_note.json'
        row['report_path']=str(path)
        if note.exists():
            row['measurement_note']=json.loads(note.read_text())
        rows.append(row)
    return rows


def summarize(root):
    rows = reports(root)
    print('| Round | Preset | Seconds | Attempted | Accepted | Rate | Score |')
    print('|---|---|---:|---:|---:|---:|---:|')
    for row in rows:
        if row.get('measurement_note',{}).get('valid_for_candidate_sweep') is False:
            print(f"Excluded from candidate comparison: {row['label']} ({row['measurement_note']['reason']})")
            continue
        rate = row.get('acceptance_rate')
        rate = f'{rate:.2%}' if rate is not None else 'unverified'
        print(f"| {row['label']} | {row['preset']} | {row.get('total_s',0):.2f} | {row.get('attempted','?')} | {row.get('accepted','?')} | {rate} | {row.get('score','?')} |")
    baseline = [r for r in rows if r['label'].startswith('baseline-') and r.get('status')=='complete' and r.get('acceptance_rate') is not None]
    if baseline:
        print('Baseline mean seconds:',statistics.mean(r['total_s'] for r in baseline))
        print('Baseline acceptance:',sum(r['accepted'] for r in baseline)/sum(r['attempted'] for r in baseline))
    return rows


def promote(root, preset):
    config=json.loads(CONFIG_PATH.read_text())
    target=config['presets'][preset]
    expected=fingerprint(target)
    rows=[r for r in reports(root) if r.get('measurement_note',{}).get('valid_for_candidate_sweep') is not False]
    baseline=[r for r in rows if r['label'].startswith('baseline-') and r.get('status')=='complete' and r.get('acceptance_rate') is not None]
    if len(baseline)<3:
        raise ValueError('Three measured baseline rounds required')
    rate=sum(r['accepted'] for r in baseline)/sum(r['attempted'] for r in baseline)
    complete=[r for r in rows if r.get('status')=='complete']
    stable=complete[-5:]
    if len(stable)<5 or not all(r['label'].startswith('stability-') and r.get('execution_fingerprint')==expected and r.get('acceptance_rate') is not None for r in stable):
        raise ValueError('Five consecutive measured stability rounds at the exact preset settings required')
    actual=sum(r['accepted'] for r in stable)/sum(r['attempted'] for r in stable)
    if actual<rate-.02:
        raise ValueError(f'Acceptance {actual:.2%} is below baseline {rate:.2%} minus 2 percentage points')
    target['live_verified']=True
    target['validation']={'baseline_rate':rate,'stability_rate':actual,'reports':[r['report_path'] for r in stable]}
    CONFIG_PATH.write_text(json.dumps(config,indent=2)+'\n')
    print(f'Promoted {preset}: {actual:.2%} acceptance; final launcher validation still required.')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('runs')
    parser.add_argument('--promote',choices=['fast','max'])
    args=parser.parse_args()
    summarize(args.runs)
    if args.promote:
        promote(args.runs,args.promote)
