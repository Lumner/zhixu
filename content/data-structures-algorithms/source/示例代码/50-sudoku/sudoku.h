#ifndef DSA_MINI_SUDOKU_H
#define DSA_MINI_SUDOKU_H
#include "design.h"
#define MINI_SIDE 4
typedef struct { unsigned char cells[MINI_SIDE][MINI_SIDE]; } MiniGrid;
typedef struct { MiniGrid first; unsigned long solutions, nodes; } SudokuResult;
DStatus sudoku_solve(const MiniGrid *puzzle, SudokuResult *out);
#endif
