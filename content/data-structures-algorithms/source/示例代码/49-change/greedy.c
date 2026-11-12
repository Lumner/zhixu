#include "coins.h"
DStatus greedy_change(const unsigned *coins, size_t n, unsigned amount, Change *out)
{
    if (out == NULL || (n != 0 && coins == NULL)) { return D_INVALID; }
    if (n > D_COINS || amount > D_LIMIT) { return D_RANGE; }
    for (size_t i = 0; i < n; i++) {
        if (coins[i] == 0 || coins[i] > D_DENOM) { return D_RANGE; }
        if (i > 0 && coins[i - 1] <= coins[i]) { return D_INVALID; }
    }
    Change next = {0};
    unsigned remaining = amount;
    for (size_t i = 0; i < n; i++) {
        next.evaluations++;
        next.counts[i] = remaining / coins[i];
        remaining %= coins[i];
        next.total += next.counts[i];
    }
    if (remaining != 0) { return D_STUCK; }
    next.possible = 1;
    *out = next;
    return D_OK;
}
