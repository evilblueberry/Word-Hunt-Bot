import cv2
import numpy as np


# find start button on pop up using reference image
def find_button_location(screenshot_path, button_image_path):

    screenshot = cv2.imread(screenshot_path)
    start_button_image = cv2.imread(button_image_path)

    screenshot_gray = cv2.cvtColor(screenshot, cv2.COLOR_BGR2GRAY)
    start_button_gray = cv2.cvtColor(start_button_image, cv2.COLOR_BGR2GRAY)


    result = cv2.matchTemplate(screenshot_gray, start_button_gray, cv2.TM_CCOEFF_NORMED)

    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

    top_left = max_loc
    button_center = (top_left[0] + start_button_image.shape[1] // 2, top_left[1] + start_button_image.shape[0] // 2)
    

    return button_center
