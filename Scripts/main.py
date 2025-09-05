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

options = XCUITestOptions()
options.load_capabilities({
    "platformName": "iOS",
    "platformVersion": "18.3",
    "deviceName": "iPhone",
    "udid": "00008120-000C65C00CA2201E",
    "automationName": "XCUITest",
    "bundleId": "com.apple.MobileSMS",
    "noReset": True
})

driver = webdriver.Remote("http://127.0.0.1:4723", options=options)
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
image_directory = "images/"
start_button_image_path = image_directory + "start_button_image.png"

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
game_board = driver.get_screenshot_as_file("game_board.png")
if game_board:
    game_board_path = "game_board.png"
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