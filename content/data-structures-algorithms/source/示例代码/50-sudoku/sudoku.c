#include "sudoku.h"
typedef struct {
    MiniGrid board;
    unsigned rows[MINI_SIDE], cols[MINI_SIDE], boxes[MINI_SIDE];
    SudokuResult *result;
} SudokuSearch;
static void fill(SudokuSearch *search, size_t position)
{
    search->result->nodes++;
    while (position < 16 && search->board.cells[position / 4][position % 4] != 0) {
        position++;
    }
    if (position == 16) {
        if (search->result->solutions == 0) { search->result->first = search->board; }
        search->result->solutions++;
        return;
    }
    size_t row = position / 4, col = position % 4, box = (row / 2) * 2 + col / 2;
    for (unsigned digit = 1; digit <= 4; digit++) {
        unsigned bit = 1u << (digit - 1);
        if ((search->rows[row] | search->cols[col] | search->boxes[box]) & bit) {
            continue;
        }
        search->board.cells[row][col] = (unsigned char)digit;
        search->rows[row] |= bit; search->cols[col] |= bit; search->boxes[box] |= bit;
        fill(search, position + 1);
        search->board.cells[row][col] = 0;
        search->rows[row] &= ~bit; search->cols[col] &= ~bit; search->boxes[box] &= ~bit;
    }
}
DStatus sudoku_solve(const MiniGrid *puzzle, SudokuResult *out)
{
    if (puzzle == NULL || out == NULL) { return D_INVALID; }
    SudokuResult next = {0};
    SudokuSearch search = {0};
    search.board = *puzzle; search.result = &next;
    for (size_t row = 0; row < 4; row++) {
        for (size_t col = 0; col < 4; col++) {
            unsigned digit = puzzle->cells[row][col];
            if (digit > 4) { return D_RANGE; }
            if (digit == 0) { continue; }
            size_t box = (row / 2) * 2 + col / 2;
            unsigned bit = 1u << (digit - 1);
            if ((search.rows[row] | search.cols[col] | search.boxes[box]) & bit) {
                return D_INVALID;
            }
            search.rows[row] |= bit; search.cols[col] |= bit; search.boxes[box] |= bit;
        }
    }
    fill(&search, 0);
    *out = next;
    return D_OK;
}
