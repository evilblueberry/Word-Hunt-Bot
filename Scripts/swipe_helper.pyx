
cdef int calculate_x(int grid_x, int col, int cell_size):
    return grid_x + col * cell_size + (cell_size // 2)

cdef int calculate_y(int grid_y, int row, int cell_size):
    return grid_y + row * cell_size + (cell_size // 2)
