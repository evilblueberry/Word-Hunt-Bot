import os
import time
from pathlib import Path

import numpy as np
from appium import webdriver
from appium.options.ios import XCUITestOptions
from PIL import Image

from dictionaries import temp_dictionary
from image_recognition import find_button_location
from modules import find_best_word
from modules import get_cell_size
from modules import get_cropped_image
from modules import get_letter_grid
from modules import swipe_word
from modules import tap_point

UDID = os.environ.get("BOT_UDID", "")
BUNDLE_ID = os.environ.get("BOT_BUNDLE_ID", "com.apple.MobileSMS")
TEAM_ID = os.environ.get("BOT_TEAM_ID", "")
PORT = os.environ.get("BOT_PORT", "4723")
XCODE_SIGNING_ID = os.environ.get("BOT_XCODE_SIGNING_ID", "Apple Development")
UPDATED_WDA_BUNDLE_ID = os.environ.get("BOT_UPDATED_WDA_BUNDLE_ID", "")
GRID_SIZE = 4

BASE_DIR = Path(__file__).resolve().parent.parent
IMAGES_DIR = BASE_DIR / "images"
WORK_DIR = Path(os.environ.get("BOT_WORKDIR", str(BASE_DIR))).resolve()
WORK_DIR.mkdir(parents=True, exist_ok=True)


def build_driver():
    options = XCUITestOptions()
    options.platform_name = "iOS"
    options.automation_name = "XCUITest"
    options.bundle_id = BUNDLE_ID
    options.no_reset = True

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
    button_location = find_button_location(str(screenshot_path), str(start_button_image_path))

    scaled_x = int(button_location[0] * screen_size["width"] / screenshot_width)
    scaled_y = int(button_location[1] * screen_size["height"] / screenshot_height)
    tap_point(driver, scaled_x, scaled_y)

    return screenshot_width, screenshot_height, screen_size["width"], screen_size["height"]


def run_bot(driver, game_path: Path, grid_left, cell_size, grid_size):
    letter_grid = get_letter_grid(str(game_path), grid_size)
    letters = set(letter_grid.flatten().tolist())
    letters = {letter.lower() for letter in letters}

    word_list = temp_dictionary(letters)
    valid_words_list = find_best_word(letter_grid, word_list)
    valid_words_list.sort(key=lambda item: len(item[0]), reverse=True)

    for word, positions in valid_words_list:
        print(f"Swiping word: {word}")
        swipe_word(driver, positions, grid_left, cell_size)


def main():
    driver = build_driver()
    time.sleep(5)

    try:
        try:
            play_button = driver.find_element("xpath", "//*[@name='play_button_overlay']")
            play_button.click()
            time.sleep(2)
        except Exception as error:
            print(f"Play button overlay not found: {error}")

        screenshot_path = WORK_DIR / "screenshot.png"
        screenshot_width, screenshot_height, screen_width, screen_height = start_round(
            driver,
            screenshot_path,
        )

        time.sleep(1)

        game_board_path = WORK_DIR / "game_board.png"
        if driver.get_screenshot_as_file(str(game_board_path)):
            print(f"Saved game board screenshot to {game_board_path}")
        else:
            print("Failed to take game board screenshot.")

        cropped_grid = get_cropped_image(str(game_board_path))
        grid_top_left = [160, 1130]
        grid_top_left[0] = grid_top_left[0] * screen_width / screenshot_width
        grid_top_left[1] = grid_top_left[1] * screen_height / screenshot_height
        grid_top_left = tuple(grid_top_left)

        cell_size = min(get_cell_size(cropped_grid, GRID_SIZE)) * screen_width / screenshot_width
        run_bot(driver, game_board_path, grid_top_left, cell_size, GRID_SIZE)
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
