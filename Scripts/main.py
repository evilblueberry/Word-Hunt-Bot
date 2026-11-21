import os
import argparse
import json
import cv2
import time
import sys
from pathlib import Path

from appium import webdriver
from appium.options.ios import XCUITestOptions
from PIL import Image

from dictionaries import temp_dictionary, word_dictionary
from image_recognition import find_button_location
from modules import find_best_word
from modules import get_ocr_reader
from board_recognition import read_board, detect_tiles, screen_geometry
from modules import validate_letter_grid
from modules import tap_point
from modules import rank_words
from round_metrics import RoundMetrics, read_counters
from speed import load_preset, build_batches, send_batch, fingerprint, validate_tuning, DirectWDA, CONFIG_PATH
from trie_solver import TrieSolver
from device_connection import probe_device

UDID = os.environ.get("BOT_UDID", "")
BUNDLE_ID = os.environ.get("BOT_BUNDLE_ID", "com.apple.MobileSMS")
TEAM_ID = os.environ.get("BOT_TEAM_ID", "")
PORT = os.environ.get("BOT_PORT", "4723")
XCODE_SIGNING_ID = os.environ.get("BOT_XCODE_SIGNING_ID", "Apple Development")
UPDATED_WDA_BUNDLE_ID = os.environ.get("BOT_UPDATED_WDA_BUNDLE_ID", "")
GRID_SIZE = 4
RUNTIME_CONFIG = json.loads(CONFIG_PATH.read_text())

BASE_DIR = Path(__file__).resolve().parent.parent
IMAGES_DIR = BASE_DIR / "images"
WORK_DIR = Path(os.environ.get("BOT_WORKDIR", str(BASE_DIR))).resolve()
WORK_DIR.mkdir(parents=True, exist_ok=True)


def build_driver(rebuild_wda=False, platform_version=None):
    options = XCUITestOptions()
    options.platform_name = "iOS"
    if platform_version:
        options.platform_version = platform_version
    options.automation_name = "XCUITest"
    options.bundle_id = BUNDLE_ID
    options.no_reset = True
    options.new_command_timeout = RUNTIME_CONFIG['session_idle_timeout_s']
    options.set_capability("appium:showXcodeLog", True)
    options.set_capability("appium:wdaLaunchTimeout", 240000)
    options.set_capability("appium:wdaConnectionTimeout", 240000)
    if rebuild_wda:
        options.set_capability('appium:useNewWDA',True)
        options.set_capability('appium:allowProvisioningDeviceRegistration',True)

    if UDID:
        options.udid = UDID

    if TEAM_ID:
        options.xcode_org_id = TEAM_ID
        options.xcode_signing_id = XCODE_SIGNING_ID

    if UPDATED_WDA_BUNDLE_ID:
        options.set_capability("appium:updatedWDABundleId", UPDATED_WDA_BUNDLE_ID)

    return webdriver.Remote(f"http://127.0.0.1:{PORT}", options=options)


def start_round(driver, screenshot_path: Path):
    start_button_image_path = IMAGES_DIR / "start_button_image.png"
    driver.get_screenshot_as_file(str(screenshot_path))

    with Image.open(screenshot_path) as screenshot_image:
      screenshot_width, screenshot_height = screenshot_image.size

    screen_size = driver.get_window_size()
    button_location = find_button_location(
        str(screenshot_path), str(start_button_image_path), min_confidence=0.55
    )

    scaled_x = int(button_location[0] * screen_size["width"] / screenshot_width)
    scaled_y = int(button_location[1] * screen_size["height"] / screenshot_height)
    tap_point(driver, scaled_x, scaled_y)

    return screenshot_width, screenshot_height, screen_size["width"], screen_size["height"]


def run_bot(driver, game_path: Path, grid_size=GRID_SIZE, dry_run=False, reader=None, metrics=None, deadline=None,
            tuning=None, solver=None, screen_size=None, transport=None):
    tuning = tuning or load_preset('safe')[1]
    if metrics:
        metrics.data['execution_tuning'] = tuning
        metrics.data['execution_fingerprint'] = fingerprint(tuning)
    stage = time.perf_counter()
    letter_grid, boxes = read_board(str(game_path), reader or get_ocr_reader(), grid_size,
                                    debug_dir=game_path.parent / 'ocr_debug' if tuning['debug_images'] else None)
    if metrics:
        metrics.data['stages_s']['ocr'] = time.perf_counter() - stage
    validate_letter_grid(letter_grid, grid_size)
    print('Recognized board:\n' + '\n'.join(' '.join(row) for row in letter_grid), flush=True)
    letters = set(''.join(letter_grid.flatten()).lower())

    stage = time.perf_counter()
    word_list = word_dictionary if solver else temp_dictionary(letters)
    valid_words_list = solver.solve(letter_grid) if solver else find_best_word(letter_grid, word_list)
    valid_words_list = [(word,path) for word,path in valid_words_list if len(word)>=3]
    valid_words_list = rank_words(valid_words_list, word_list)
    if metrics:
        metrics.data['stages_s']['solve'] = time.perf_counter() - stage
    stage = time.perf_counter()
    with Image.open(game_path) as screenshot:
        screen_size = screen_size or driver.get_window_size()
        centers = screen_geometry(boxes, screenshot.size, screen_size)
    plan = [{'word': word, 'path': positions, 'coordinates': [centers[r][c] for r, c in positions]}
            for word, positions in valid_words_list]
    (game_path.parent / 'swipe_plan.json').write_text(json.dumps(plan, indent=2))
    remaining_ms = max(0,(deadline-time.perf_counter()-3)*1000) if deadline else None
    batches = build_batches(valid_words_list,centers,tuning,max_timeline_ms=remaining_ms)
    for batch in batches:
        batch['viewport'] = screen_size
    (game_path.parent / 'gesture_requests.json').write_text(json.dumps(batches,indent=2))
    if metrics:
        metrics.data['stages_s']['plan'] = time.perf_counter() - stage
        metrics.data['planned'] = len(plan)
        metrics.data['scheduled'] = sum(len(batch['words']) for batch in batches)
        metrics.data['omitted_for_deadline'] = len(plan)-metrics.data['scheduled']
    print(f'Found {len(plan)} words; saved swipe_plan.json and ocr_debug/board_overlay.png', flush=True)
    if dry_run:
        for item in plan:
            print(f"DRY RUN {item['word']}: {item['coordinates']}", flush=True)
        return

    previous_end = time.perf_counter()
    last_request_s = None
    for batch in batches:
        if deadline is not None and time.perf_counter() >= deadline:
            break
        if deadline is not None and len(batch['words'])>1:
            estimate = max(batch['requested_ms']/1000 + .5, (last_request_s or 0)*1.15)
            if time.perf_counter()+estimate > deadline:
                break
        print(f"Swiping: {', '.join(batch['words'])}", flush=True)
        start = time.perf_counter()
        try:
            transport.send(batch) if transport else send_batch(driver,batch)
        except Exception as error:
            if metrics:
                metrics.data['failed_batch'] = {'words':batch['words'],'error':str(error),'acceptance':'unknown'}
                metrics.flush()
            raise
        end = time.perf_counter()
        last_request_s = end-start
        print(f"Swipe request: {end-start:.4f}s; gap: {start-previous_end:.4f}s; words: {len(batch['words'])}",flush=True)
        if metrics:
            metrics.data['swipes'].append({'words': batch['words'], 'word_count':len(batch['words']),
                                            'requested_ms':batch['requested_ms'], 'duration_s': end-start, 'gap_s': start-previous_end,
                                            'start_s': start-metrics.started, 'end_s': end-metrics.started})
            metrics.flush()
        previous_end = end


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Recognize and save paths without tapping Start or swiping')
    parser.add_argument('--label', default='baseline')
    parser.add_argument('--round-seconds', type=float, default=RUNTIME_CONFIG['round_seconds'], help='Stop gestures before the game expires')
    parser.add_argument('--preset', choices=['safe','fast','max'], default=os.environ.get('BOT_SPEED_PRESET','fast'))
    parser.add_argument('--experimental', action='store_true', help='Measure unverified candidate settings')
    parser.add_argument('--swipe-ms',type=float)
    parser.add_argument('--gap-ms',type=float)
    parser.add_argument('--batch-size',type=lambda value: 'all' if value=='all' else int(value))
    parser.add_argument('--intermediate-points',type=int)
    parser.add_argument('--settings',type=json.loads)
    parser.add_argument('--solver', choices=['legacy','trie'])
    parser.add_argument('--transport',choices=['appium','wda','wda-screen'])
    parser.add_argument('--rebuild-wda',action='store_true',help='Rebuild/install WDA after an opt-in source experiment')
    args = parser.parse_args()
    process_started = time.perf_counter()
    preset,tuning,fallback = load_preset(args.preset,args.experimental)
    overrides = {'swipe_ms':args.swipe_ms,'gap_ms':args.gap_ms,'batch_size':args.batch_size,
                 'intermediate_points':args.intermediate_points,'settings':args.settings,'solver':args.solver,
                 'transport':args.transport}
    if any(value is not None for value in overrides.values()) and not args.experimental:
        parser.error('Timing overrides require --experimental and are recorded with the results')
    tuning.update({key:value for key,value in overrides.items() if value is not None})
    validate_tuning(tuning)
    print(f'Speed: {preset}' + ('; using Safe until live accuracy validation completes.' if fallback else '') ,flush=True)
    print(f"Gesture settings: {tuning['swipe_ms']} ms path; {tuning['gap_ms']} ms between words; "
          f"batch={tuning['batch_size']}; transport={tuning.get('transport','appium')}",flush=True)
    device = probe_device(UDID) if sys.platform == 'darwin' else {}
    if device and not device['connected']:
        print(f"Device preflight: {device['message']}",flush=True)
        raise SystemExit(2)
    # Load models before starting the timed round (initialization used to waste ~20 seconds).
    stage = time.perf_counter()
    reader = get_ocr_reader()
    reader_load_s = time.perf_counter()-stage
    stage = time.perf_counter()
    solver = TrieSolver(word_dictionary['Name']) if tuning['solver']=='trie' else None
    solver_load_s = time.perf_counter()-stage
    stage = time.perf_counter()
    driver = build_driver(rebuild_wda=args.rebuild_wda, platform_version=device.get('platform_version'))
    session_s = time.perf_counter()-stage
    transport = DirectWDA(screen_coordinates=tuning.get('transport')=='wda-screen') if tuning.get('transport') in ('wda','wda-screen') else None
    previous_settings = driver.get_settings() if tuning['settings'] else None
    if tuning['settings']:
        driver.update_settings(tuning['settings'])
    time.sleep(5)

    try:
        try:
            if args.dry_run:
                raise LookupError('Dry run: skipping play overlay tap')
            play_button = driver.find_element("xpath", "//*[@name='play_button_overlay']")
            play_button.click()
            time.sleep(2)
        except Exception as error:
            print(f"Play button overlay not found: {error}")

        screenshot_path = WORK_DIR / "screenshot.png"
        driver.get_screenshot_as_file(str(screenshot_path))
        game_started = None
        try:
            detect_tiles(cv2.imread(str(screenshot_path)))
            print('Board already visible; skipping Start tap.', flush=True)
        except ValueError:
            if args.dry_run:
                raise ValueError('Dry run requires an already visible Word Hunt board.')
            game_started = time.perf_counter()
            start_round(driver, screenshot_path)

        time.sleep(1)

        metrics = RoundMetrics(WORK_DIR, preset='safe' if fallback else preset, label=args.label)
        metrics.data['tuning'] = tuning
        metrics.data['tuning_fingerprint'] = fingerprint(tuning)
        metrics.data['startup_s'] = {'reader':reader_load_s,'solver_index':solver_load_s,'session':session_s}
        if previous_settings is not None:
            metrics.data['settings_before'] = {key:previous_settings.get(key) for key in tuning['settings']}
            metrics.data['settings_applied'] = {key:driver.get_settings().get(key) for key in tuning['settings']}
        game_board_path = metrics.output / "game_board.png"
        stage = time.perf_counter()
        if driver.get_screenshot_as_file(str(game_board_path)):
            print(f"Saved game board screenshot to {game_board_path}")
        else:
            print("Failed to take game board screenshot.")

        metrics.data['stages_s']['screenshot'] = time.perf_counter() - stage
        board_started = stage
        before = read_counters(game_board_path, reader)
        metrics.data['before'] = before
        try:
            run_bot(driver, game_board_path, dry_run=args.dry_run, reader=reader, metrics=metrics,
                    deadline=board_started + args.round_seconds, tuning=tuning, solver=solver, transport=transport)
            if not args.dry_run:
                after_path = metrics.output / 'after.png'
                stage = time.perf_counter()
                driver.get_screenshot_as_file(str(after_path))
                metrics.data['stages_s']['final_screenshot'] = time.perf_counter()-stage
                after = read_counters(after_path, reader)
                metrics.data['after'] = after
                if before['words'] is not None and after['words'] is not None:
                    metrics.data['accepted'] = after['words']-before['words']
                if before['score'] is not None and after['score'] is not None:
                    metrics.data['score'] = after['score']-before['score']
            metrics.data['process_total_s'] = time.perf_counter()-process_started
            metrics.data['game_elapsed_s'] = time.perf_counter()-game_started if game_started else None
            metrics.finish('dry_run' if args.dry_run else 'complete')
        except Exception:
            metrics.finish('failed')
            raise
    finally:
        if previous_settings is not None:
            driver.update_settings({key:previous_settings[key] for key in tuning['settings'] if key in previous_settings})
        if transport:
            transport.close()
        driver.quit()


if __name__ == "__main__":
    main()
