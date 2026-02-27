from appium import webdriver
from appium.options.ios import XCUITestOptions
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from image_recognition import find_button_location
from modules import get_letter_grid
from PIL import Image
from dictionaries import temp_dictionary
from modules import find_best_word
from modules import get_cropped_image
from modules import swipe_word
from modules import get_cell_size
import time
import numpy as np
import os

UDID = os.environ.get("BOT_UDID", "00008120-000C65C00CA2201E")
BUNDLE_ID = os.environ.get("BOT_BUNDLE_ID", "com.apple.MobileSMS")
TEAM_ID = os.environ.get("BOT_TEAM_ID", "")
PORT = os.environ.get("BOT_PORT", "4723")

caps = {
    "platformName": "iOS",
    "platformVersion": os.environ.get("BOT_PLATFORM_VERSION", "18.3"),
    "deviceName": "iPhone",
    "udid": UDID,
    "automationName": "XCUITest",
    "bundleId": BUNDLE_ID,
    "noReset": True
}

if TEAM_ID:
    caps["xcodeOrgId"] = TEAM_ID
    caps["xcodeSigningId"] = "iPhone Developer"

options = XCUITestOptions()
options.load_capabilities(caps)

driver = webdriver.Remote(f"http://127.0.0.1:{PORT}", options=options)
time.sleep(5)

# locate and click the play button
try:
    play_button = driver.find_element("xpath", "//*[@name='play_button_overlay']")
    play_button.click()
except Exception as e:
    print(f"Error: {e}")

time.sleep(2)


########################################################
########################################################


# call image_recognition function to hit the start button
# Ensure we are checking the relative path correctly based on the workspace
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
image_directory = os.path.join(base_dir, "images") + "/"
start_button_image_path = os.path.join(image_directory, "start_button_image.png")

screen_width = driver.get_window_size()['width']
screen_height = driver.get_window_size()['height']

# print(screen_width, screen_height)

screenshot_path = image_directory + "screenshot.png"
with Image.open(screenshot_path) as img:
    screenshot_width, screenshot_height = img.size
driver.get_screenshot_as_file(screenshot_path)

button_location = find_button_location(screenshot_path, start_button_image_path)

scaled_x = int(button_location[0] * screen_width / screenshot_width)
scaled_y = int(button_location[1] * screen_height / screenshot_height)

# print(scaled_x, scaled_y)

driver.tap([(scaled_x, scaled_y)], 1000)

time.sleep(1)


########################################################
########################################################


# take a screenshot of the game board
game_board_path = os.path.join(base_dir, "game_board.png")
game_board = driver.get_screenshot_as_file(game_board_path)
if game_board:
    print("Screenshot saved successfully!")
else:
    print("Failed to take screenshot.")


########################################################
########################################################


# automation process
def run_bot(driver, game_path, grid_left, cell_size, grid_size):
    letter_grid = get_letter_grid(game_path, grid_size)

    letters = set(letter_grid.flatten().tolist())
    letters = {letter.lower() for letter in letters}

    word_list = temp_dictionary(letters)

    valid_words_list = find_best_word(letter_grid, word_list)

    valid_words_list.sort(key=lambda x: len(x[0]), reverse=True)

    for word, positions in valid_words_list:
        # print(f"Swiping word: {word} -> {positions}")
        swipe_word(driver, positions, grid_left, cell_size)

cropped_grid = get_cropped_image(game_board_path)
grid_top_left = (160, 1130)
grid_top_left = list(grid_top_left)
grid_top_left[0] = grid_top_left[0] * screen_width / screenshot_width
grid_top_left[1] = grid_top_left[1] * screen_height / screenshot_height
grid_top_left = tuple(grid_top_left) 
# print(grid_top_left)
grid_size = 4
cell_size = min(get_cell_size(cropped_grid, grid_size)) * screen_width / screenshot_width
run_bot(driver, game_board_path, grid_top_left, cell_size, grid_size)

driver.quit()