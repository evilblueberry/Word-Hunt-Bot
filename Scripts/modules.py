import cv2
import numpy as np
# from swipe_helper import calculate_x, calculate_y

def tap_point(driver, x, y):
    from selenium.webdriver.common.actions.action_builder import ActionBuilder
    from selenium.webdriver.common.actions.pointer_input import PointerInput
    from selenium.webdriver.common.actions.interaction import POINTER_TOUCH

    actions = ActionBuilder(driver, mouse=PointerInput(POINTER_TOUCH, "touch"))
    actions.pointer_action.move_to_location(int(x), int(y))
    actions.pointer_action.pointer_down()
    actions.pointer_action.pause(0.05)
    actions.pointer_action.pointer_up()
    actions.perform()

def visualize_word_path(screenshot_path, cell_size, grid_top_left, max_rows, max_cols):
    from PIL import Image, ImageDraw

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
    return get_grid_geometry(board_grey.shape, g_size)

DEFAULT_BOARD_CROP = (150, 1100, 1030, 2000)
_OCR_READER = None


def get_board_crop(screenshot_shape, crop=DEFAULT_BOARD_CROP):
    """Return a validated (left, top, right, bottom) board crop."""
    height, width = screenshot_shape[:2]
    left, top, right, bottom = crop
    if not (0 <= left < right <= width and 0 <= top < bottom <= height):
        raise ValueError(
            f"Board crop {crop} is outside screenshot bounds {(width, height)}"
        )
    return left, top, right, bottom


def get_grid_geometry(board_shape, grid_size):
    """Return cell dimensions and reject incomplete/non-square grids."""
    if grid_size <= 0:
        raise ValueError("grid_size must be positive")
    height, width = board_shape[:2]
    if width < grid_size or height < grid_size:
        raise ValueError("Board image is too small for the requested grid")
    return width // grid_size, height // grid_size


def validate_letter_grid(grid, grid_size):
    grid = np.asarray(grid)
    if grid.shape != (grid_size, grid_size):
        raise ValueError(f"Expected a {grid_size}x{grid_size} letter grid, got {grid.shape}")
    if any(not isinstance(letter, str) or letter.upper() != 'QU' and (len(letter) != 1 or not letter.isalpha()) for letter in grid.flat):
        raise ValueError(f"OCR did not produce {grid_size * grid_size} usable letters: {grid}")
    return np.char.upper(grid)


def grid_cell_centers(grid_top_left, cell_size, grid_size):
    """Return device-coordinate centers for a square grid."""
    if cell_size <= 0 or grid_size <= 0:
        raise ValueError("cell_size and grid_size must be positive")
    left, top = grid_top_left
    return [
        [
            (left + col * cell_size + cell_size / 2, top + row * cell_size + cell_size / 2)
            for col in range(grid_size)
        ]
        for row in range(grid_size)
    ]


def path_to_coordinates(word_path, grid_top_left, cell_size, grid_size):
    """Convert a word path to touch coordinates after validating every cell."""
    if not word_path:
        raise ValueError("Cannot swipe an empty word path")
    centers = grid_cell_centers(grid_top_left, cell_size, grid_size)
    coordinates = []
    for index, (row, col) in enumerate(word_path):
        if not (0 <= row < grid_size and 0 <= col < grid_size):
            raise ValueError(f"Word path cell {(row, col)} is outside the {grid_size}x{grid_size} grid")
        if (row, col) in word_path[:len(coordinates)]:
            raise ValueError(f"Word path reuses cell {(row, col)}")
        if index and max(abs(row - word_path[index - 1][0]), abs(col - word_path[index - 1][1])) > 1:
            raise ValueError(f"Word path jumps from {word_path[index - 1]} to {(row, col)}")
        coordinates.append(centers[row][col])
    return coordinates


def rank_words(valid_words, word_dictionary):
    """Rank words by game value, then length, then stable alphabetical order."""
    values = dict(zip(word_dictionary['Name'], word_dictionary['Value']))
    return sorted(valid_words, key=lambda item: (values.get(item[0], 0), len(item[0]), item[0]), reverse=True)


# gets cropped greyscaled game board
def get_cropped_image(screenshot, crop=DEFAULT_BOARD_CROP):
    game_board = cv2.imread(screenshot)
    if game_board is None:
        raise ValueError(f"Could not read game board screenshot: {screenshot}")
    left, top, right, bottom = get_board_crop(game_board.shape, crop)
    cropped_board = game_board[top:bottom, left:right]

    game_board_grey = cv2.cvtColor(cropped_board, cv2.COLOR_BGR2GRAY)

    # plt.imshow(game_board_grey, cmap='gray')
    # plt.axis('off')  # Turn off axis labels
    # plt.show()

    return game_board_grey

# creates a 2d numpy array of letters
def get_ocr_reader():
    global _OCR_READER
    if _OCR_READER is None:
        import easyocr
        _OCR_READER = easyocr.Reader(['en'], gpu=False, detector=False)
    return _OCR_READER


def get_letter_grid(screenshot_path, grid_size):
    from board_recognition import read_board
    grid, _ = read_board(screenshot_path, get_ocr_reader(), grid_size)
    return validate_letter_grid(grid, grid_size)


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




def swipe_word(driver, word_path, grid_top_left, cell_size, grid_size=4, centers=None):

    from selenium.webdriver.common.actions.action_builder import ActionBuilder
    from selenium.webdriver.common.actions.pointer_input import PointerInput
    from selenium.webdriver.common.actions.interaction import POINTER_TOUCH


    # initialize the ActionBuilder with touch input
    actions = ActionBuilder(driver, mouse=PointerInput(POINTER_TOUCH, "touch"))
    
    coordinates = path_to_coordinates(word_path, grid_top_left, cell_size, grid_size)
    if centers is not None:
        coordinates = [centers[row][col] for row, col in word_path]
    start_x, start_y = coordinates[0]
    # print(start_x)
    # print(start_y)

    # move to the starting position and press down
    actions.pointer_action.move_to_location(start_x, start_y)
    actions.pointer_action.pointer_down()
    # actions.pointer_action.pause(0.001)
    

    # swipe through the remaining coordinates in the word path
    for next_x, next_y in coordinates[1:]:
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
