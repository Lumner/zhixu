#include <stdio.h>
#include "sudoku.h"
int main(void)
{
    MiniGrid puzzle = {{{1,0,3,4}, {3,4,0,2}, {2,1,4,0}, {0,3,2,1}}};
    SudokuResult result;
    if (sudoku_solve(&puzzle, &result) != D_OK) { return 1; }
    printf("solutions=%lu\n", result.solutions);
    if (result.solutions == 0) { return 0; }
    for (size_t r = 0; r < 4; r++) {
        for (size_t c = 0; c < 4; c++) {
            printf("%s%u", c == 0 ? "" : " ", (unsigned)result.first.cells[r][c]);
        }
        puts("");
    }
    return 0;
}
