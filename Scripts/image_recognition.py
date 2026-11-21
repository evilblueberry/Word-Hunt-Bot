import cv2
import numpy as np


# find start button on pop up using reference image
def find_button_location(screenshot_path, button_image_path, min_confidence=0.55):

    screenshot = cv2.imread(screenshot_path)
    start_button_image = cv2.imread(button_image_path)

    if screenshot is None:
        raise ValueError(f"Could not read screenshot: {screenshot_path}")
    if start_button_image is None:
        raise ValueError(f"Could not read button reference image: {button_image_path}")
    if (
        start_button_image.shape[0] > screenshot.shape[0]
        or start_button_image.shape[1] > screenshot.shape[1]
    ):
        raise ValueError("Button reference image is larger than the screenshot")

    screenshot_gray = cv2.cvtColor(screenshot, cv2.COLOR_BGR2GRAY)
    start_button_gray = cv2.cvtColor(start_button_image, cv2.COLOR_BGR2GRAY)


    result = cv2.matchTemplate(screenshot_gray, start_button_gray, cv2.TM_CCOEFF_NORMED)

    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

    if max_val < min_confidence:
        raise ValueError(
            f"Start button match confidence {max_val:.3f} is below "
            f"the required {min_confidence:.3f}"
        )

    top_left = max_loc
    button_center = (top_left[0] + start_button_image.shape[1] // 2, top_left[1] + start_button_image.shape[0] // 2)
    

    return button_center
