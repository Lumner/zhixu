#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "sudoku.h"
#define REQUIRE(test) do { if (!(test)) { fprintf(stderr,"sudoku oracle failed at %d\n",__LINE__); exit(1); } } while (0)
static MiniGrid solutions[288];
static size_t solution_count;
static int complete(const MiniGrid *grid)
{
    for (size_t r = 0; r < 4; r++) {
        for (size_t c = 0; c < 4; c++) {
            unsigned value = grid->cells[r][c];
            if (value < 1 || value > 4) { return 0; }
            for (size_t other = 0; other < c; other++) {
                if (grid->cells[r][other] == value) { return 0; }
            }
            for (size_t other = 0; other < r; other++) {
                if (grid->cells[other][c] == value) { return 0; }
            }
            for (size_t rr = r / 2 * 2; rr < r / 2 * 2 + 2; rr++) {
                for (size_t cc = c / 2 * 2; cc < c / 2 * 2 + 2; cc++) {
                    if ((rr != r || cc != c) && grid->cells[rr][cc] == value) { return 0; }
                }
            }
        }
    }
    return 1;
}
static size_t reference(const MiniGrid *puzzle)
{
    size_t count = 0;
    for (size_t s = 0; s < solution_count; s++) {
        int match = 1;
        for (size_t r = 0; r < 4; r++) {
            for (size_t c = 0; c < 4; c++) {
                if (puzzle->cells[r][c] != 0 && puzzle->cells[r][c] != solutions[s].cells[r][c]) { match = 0; }
            }
        }
        if (match) { count++; }
    }
    return count;
}
static int legal_clues(const MiniGrid *puzzle)
{
    for (size_t i = 0; i < 16; i++) {
        unsigned value = puzzle->cells[i / 4][i % 4];
        if (value == 0) { continue; }
        for (size_t j = 0; j < i; j++) {
            if (value == puzzle->cells[j / 4][j % 4] &&
                (i / 4 == j / 4 || i % 4 == j % 4 ||
                 (i / 8 == j / 8 && (i % 4) / 2 == (j % 4) / 2))) { return 0; }
        }
    }
    return 1;
}
static void check_puzzle(const MiniGrid *puzzle, size_t count)
{
    MiniGrid before; memcpy(&before,puzzle,sizeof(before));
    SudokuResult result;
    REQUIRE(sudoku_solve(puzzle,&result) == D_OK);
    REQUIRE(result.solutions == count && result.nodes >= 1 && result.nodes <= 937625ul);
    REQUIRE(memcmp(&before,puzzle,sizeof(before)) == 0);
    if (count != 0) {
        REQUIRE(complete(&result.first));
        for (size_t r = 0; r < 4; r++) {
            for (size_t c = 0; c < 4; c++) {
                REQUIRE(puzzle->cells[r][c] == 0 || puzzle->cells[r][c] == result.first.cells[r][c]);
            }
        }
    } else {
        MiniGrid empty = {{{0}}}; REQUIRE(memcmp(&empty,&result.first,sizeof(empty)) == 0);
    }
}
int main(void)
{
    unsigned char rows[24][4]; size_t n = 0;
    for (unsigned a = 1; a <= 4; a++) for (unsigned b = 1; b <= 4; b++)
    for (unsigned c = 1; c <= 4; c++) for (unsigned d = 1; d <= 4; d++) {
        if (a != b && a != c && a != d && b != c && b != d && c != d) {
            rows[n][0] = (unsigned char)a; rows[n][1] = (unsigned char)b;
            rows[n][2] = (unsigned char)c; rows[n][3] = (unsigned char)d; n++;
        }
    }
    REQUIRE(n == 24);
    for (size_t a = 0; a < 24; a++) for (size_t b = 0; b < 24; b++)
    for (size_t c = 0; c < 24; c++) for (size_t d = 0; d < 24; d++) {
        MiniGrid grid; memcpy(grid.cells[0],rows[a],4); memcpy(grid.cells[1],rows[b],4);
        memcpy(grid.cells[2],rows[c],4); memcpy(grid.cells[3],rows[d],4);
        if (complete(&grid)) { REQUIRE(solution_count < 288); solutions[solution_count++] = grid; }
    }
    REQUIRE(solution_count == 288);
    unsigned matches[288] = {0};
    for (size_t s = 0; s < 288; s++) {
        for (size_t p = 0; p < 16; p++) {
            if (solutions[s].cells[p / 4][p % 4] == solutions[0].cells[p / 4][p % 4]) { matches[s] |= 1u << p; }
        }
    }
    for (unsigned long mask = 0; mask < 65536ul; mask++) {
        MiniGrid puzzle = {{{0}}};
        for (size_t p = 0; p < 16; p++) {
            if (mask & (1ul << p)) { puzzle.cells[p / 4][p % 4] = solutions[0].cells[p / 4][p % 4]; }
        }
        size_t count = 0;
        for (size_t s = 0; s < 288; s++) { if ((mask & ~(unsigned long)matches[s]) == 0) { count++; } }
        check_puzzle(&puzzle,count);
    }
    for (size_t s = 0; s < 288; s++) { check_puzzle(&solutions[s],1); }
    unsigned long impossible = 0;
    for (size_t p = 0; p < 16; p++) for (unsigned digit = 1; digit <= 4; digit++) {
        MiniGrid puzzle = {{{0}}};
        for (size_t q = 0; q < 16; q++) {
            if (q % 3 == 0) { puzzle.cells[q / 4][q % 4] = solutions[0].cells[q / 4][q % 4]; }
        }
        puzzle.cells[p / 4][p % 4] = (unsigned char)digit;
        if (legal_clues(&puzzle)) {
            size_t count = reference(&puzzle); check_puzzle(&puzzle,count);
            if (count == 0) { impossible++; }
        }
    }
    REQUIRE(impossible != 0);
    SudokuResult output, old; memset(&output,0x5a,sizeof(output)); memcpy(&old,&output,sizeof(old));
    MiniGrid puzzle = {{{1,1,0,0},{0},{0},{0}}};
    REQUIRE(sudoku_solve(&puzzle,&output) == D_INVALID);
    puzzle = (MiniGrid){{{1,0,0,0},{1,0,0,0},{0},{0}}};
    REQUIRE(sudoku_solve(&puzzle,&output) == D_INVALID);
    puzzle = (MiniGrid){{{1,0,0,0},{0,1,0,0},{0},{0}}};
    REQUIRE(sudoku_solve(&puzzle,&output) == D_INVALID);
    puzzle.cells[0][0] = 5;
    REQUIRE(sudoku_solve(&puzzle,&output) == D_RANGE);
    REQUIRE(sudoku_solve(NULL,&output) == D_INVALID);
    REQUIRE(sudoku_solve(&puzzle,NULL) == D_INVALID);
    REQUIRE(memcmp(&output,&old,sizeof(output)) == 0);
    printf("row_candidates=331776 solutions=288 clue_masks=65536 impossible_cases=%lu boundaries=1\n",impossible);
    return 0;
}
