#ifndef DSA_COINS_H
#define DSA_COINS_H
#include "design.h"
typedef struct {
    unsigned counts[D_COINS];
    size_t total;
    int possible;
    unsigned long evaluations;
} Change;
DStatus greedy_change(const unsigned *coins, size_t n, unsigned amount, Change *out);
DStatus min_change_memo(const unsigned *coins, size_t n, unsigned amount, Change *out);
DStatus min_change_table(const unsigned *coins, size_t n, unsigned amount, Change *out);
#endif
