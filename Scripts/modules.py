import cv2
import easyocr
import numpy as np
import matplotlib.pyplot as plt
import math
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.actions.action_builder import ActionBuilder
from selenium.webdriver.common.actions.pointer_input import PointerInput
from selenium.webdriver.common.actions.interaction import POINTER_TOUCH
from PIL import Image, ImageDraw
# from swipe_helper import calculate_x, calculate_y
import time

def visualize_word_path(screenshot_path, cell_size, grid_top_left, max_rows, max_cols):
    # Open the screenshot
    screenshot = Image.open(screenshot_path)
    draw = ImageDraw.Draw(screenshot)

    # Iterate over the grid to calculate and mark the center of each cell
    for row in range(max_rows):
        for col in range(max_cols):
            center_x = grid_top_left[0] + col * cell_size + (cell_size // 2)
            center_y = grid_top_left[1] + row * cell_size + (cell_size // 2)
            # Draw a dot (a small circle) at the location (center_x, center_y)
            draw.ellipse([(center_x - 5, center_y - 5), (center_x + 5, center_y + 5)], fill='red')  # radius = 5

    # Save or show the image with the dots
    screenshot.show()  # To display the image with dots
    screenshot.save("word_path_visualized.png") 



def get_cell_size(board_grey, g_size):
    grid_size = g_size
    cell_width = board_grey.shape[1] // grid_size
    cell_height = board_grey.shape[0] // grid_size
    return cell_width, cell_height

# gets cropped greyscaled game board
def get_cropped_image(screenshot):
    game_board = cv2.imread(screenshot)
    cropped_board = game_board[1100:2000, 150:1030] 

    game_board_grey = cv2.cvtColor(cropped_board, cv2.COLOR_BGR2GRAY)

    # plt.imshow(game_board_grey, cmap='gray')
    # plt.axis('off')  # Turn off axis labels
    # plt.show()

    return game_board_grey

# creates a 2d numpy array of letters
def get_letter_grid(screenshot_path, grid_size):

    game_board_grey = get_cropped_image(screenshot_path)

    cell_width, cell_height = get_cell_size(game_board_grey, grid_size)
    
    reader = easyocr.Reader(['en']) 
    result = reader.readtext(np.array(game_board_grey))
    
    # output_folder = "cropped_cells"
    # os.makedirs(output_folder, exist_ok=True)

    letters = []
    for row in range(grid_size):
        for col in range(grid_size):
            x1, y1 = col * cell_width, row * cell_height
            x2, y2 = x1 + cell_width, y1 + cell_height
            cell = game_board_grey[y1:y2, x1:x2]

            # cell_filename = f"{output_folder}/cell_{row}_{col}.png"
            # cv2.imwrite(cell_filename, cell)

            result = reader.readtext(cell, detail=0)

            if result:
                detected_text = result[0].upper().strip()
                if detected_text.isalpha() and len(detected_text) == 1:  # ensure single letters
                    letters.append(detected_text)
                else:
                    letters.append('?')
            else:
                letters.append('?') 

    # grid_size = int(math.sqrt(len(letters)))
    grid = np.array(letters).reshape(grid_size, grid_size)

    return grid


# finds the coordinates of the best word
def find_best_word(grid, word_list):
    grid = np.char.lower(grid)
    rows, cols = grid.shape
    valid_words = []
    word_set = set(word_list['Name'])
    prefix_set = {word[:i] for word in word_set for i in range(1, len(word) + 1)}

    def find_word(x, y, path, current_word):
        if current_word not in prefix_set:
            return
        
        if current_word in word_set and not any(current_word == word_tuple[0] for word_tuple in valid_words):
            valid_words.append((current_word, path[:]))

        directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if 0 <= nx < rows and 0 <= ny < cols and (nx, ny) not in path:
                find_word(nx, ny, path + [(nx, ny)], current_word + grid[nx, ny])

    for r in range(rows):
        for c in range(cols):
            find_word(r, c, [(r, c)], grid[r, c]) 

    return valid_words




def swipe_word(driver, word_path, grid_top_left, cell_size):

    # initialize the ActionBuilder with touch input
    actions = ActionBuilder(driver, mouse=PointerInput(POINTER_TOUCH, "touch"))
    
    # calculate the starting coordinates
    start_x = grid_top_left[0] + word_path[0][1] * cell_size + (cell_size // 2)
    start_y = grid_top_left[1] + word_path[0][0] * cell_size + (cell_size // 2)
    # print(start_x)
    # print(start_y)

    # move to the starting position and press down
    actions.pointer_action.move_to_location(start_x, start_y)
    actions.pointer_action.pointer_down()
    # actions.pointer_action.pause(0.001)
    

    # swipe through the remaining coordinates in the word path
    for row, col in word_path[1:]:
        next_x = grid_top_left[0] + col * cell_size + (cell_size // 2)
        next_y = grid_top_left[1] + row * cell_size + (cell_size // 2)
        actions.pointer_action.move_to_location(next_x, next_y)

    # release the touch
    actions.pointer_action.pointer_up()

    # perform the actions
    actions.perform()

    # time.sleep(0.001)
    # post_swipe_screenshot_path = "board_after_swipe.png"
    # driver.get_screenshot_as_file(post_swipe_screenshot_path)
    # print(f"Post-swipe screenshot saved as {post_swipe_screenshot_path}")

    return word_path


# def swipe_word(driver, word_path, grid_top_left, cell_size):
#     # Initialize the ActionBuilder with touch input
#     actions = ActionBuilder(driver, mouse=PointerInput(POINTER_TOUCH, "touch"))

#     # Calculate the starting coordinates
#     start_x = grid_top_left[0] + word_path[0][1] * cell_size + (cell_size // 2)
#     start_y = grid_top_left[1] + word_path[0][0] * cell_size + (cell_size // 2)
#     print(start_x)
#     print(start_y)

#     # Move to the starting position and press down
#     actions.pointer_action.move_to_location(start_x, start_y)
#     actions.pointer_action.pointer_down()
#     actions.pointer_action.pause(0.08)

#     # Swipe through the remaining coordinates in the word path
#     for row, col in word_path[1:]:
#         next_x = grid_top_left[0] + col * cell_size + (cell_size // 2)
#         next_y = grid_top_left[1] + row * cell_size + (cell_size // 2)
#         actions.pointer_action.move_to_location(next_x, next_y)

#     # Release the touch
#     actions.pointer_action.pointer_up()

#     # Perform the actions
#     actions.perform()

#     time.sleep(0.01)
#     post_swipe_screenshot_path = "board_after_swipe.png"
#     driver.get_screenshot_as_file(post_swipe_screenshot_path)
#     print(f"Post-swipe screenshot saved as {post_swipe_screenshot_path}")

#     # Now visualize the full grid with dots
#     visualize_word_path(post_swipe_screenshot_path, cell_size, (200, 1100), 4, 4)

#     return word_path





# def swipe_word(driver, word_path, grid_top_left, cell_size):
#     # Initialize the ActionBuilder once
#     actions = ActionBuilder(driver, mouse=PointerInput(POINTER_TOUCH, "touch"))

#     # Precompute cell centers for the entire word path once
#     swipe_path = [
#         (
#             grid_top_left[0] + col * cell_size + (cell_size // 2),
#             grid_top_left[1] + row * cell_size + (cell_size // 2),
#         )
#         for row, col in word_path
#     ]

#     # Start the swipe action
#     actions.pointer_action.move_to_location(*swipe_path[0])
#     actions.pointer_action.pointer_down()

#     # Continue moving through the points without hesitation
#     for x, y in swipe_path[1:]:
#         actions.pointer_action.move_to_location(x, y)

#     # Finish the swipe action
#     actions.pointer_action.pointer_up()

#     # Perform all actions in a single batch to avoid delay
#     actions.perform()







# def swipe_word(driver, word_path, grid_top_left, cell_size):
#     actions = ActionBuilder(driver, mouse=PointerInput(POINTER_TOUCH, "touch"))

#     # Faster calculations using Cython
#     start_x = calculate_x(grid_top_left[0], word_path[0][1], cell_size)
#     start_y = calculate_y(grid_top_left[1], word_path[0][0], cell_size)

#     actions.pointer_action.move_to_location(start_x, start_y)
#     actions.pointer_action.pointer_down()

#     for row, col in word_path[1:]:
#         next_x = calculate_x(grid_top_left[0], col, cell_size)
#         next_y = calculate_y(grid_top_left[1], row, cell_size)
#         actions.pointer_action.move_to_location(next_x, next_y)

#     actions.pointer_action.pointer_up()
#     actions.perform()

#     return word_path
