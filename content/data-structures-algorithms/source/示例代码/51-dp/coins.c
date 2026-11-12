#include "coins.h"
#define NO_CHANGE (D_LIMIT + 1u)
typedef struct {
    const unsigned *coins;
    size_t n, choice[D_LIMIT + 1];
    unsigned best[D_LIMIT + 1];
    unsigned char known[D_LIMIT + 1];
    unsigned long evaluations;
} CoinWork;
static DStatus validate(const unsigned *coins, size_t n, unsigned amount, Change *out)
{
    if (out == NULL || (n != 0 && coins == NULL)) { return D_INVALID; }
    if (n > D_COINS || amount > D_LIMIT) { return D_RANGE; }
    for (size_t i = 0; i < n; i++) {
        if (coins[i] == 0 || coins[i] > D_DENOM) { return D_RANGE; }
        if (i > 0 && coins[i - 1] <= coins[i]) { return D_INVALID; }
    }
    return D_OK;
}
static CoinWork begin(const unsigned *coins, size_t n)
{
    CoinWork work = {0};
    work.coins = coins; work.n = n;
    for (unsigned a = 0; a <= D_LIMIT; a++) {
        work.best[a] = NO_CHANGE; work.choice[a] = D_COINS;
    }
    return work;
}
static unsigned solve(CoinWork *work, unsigned amount)
{
    if (work->known[amount]) { return work->best[amount]; }
    work->known[amount] = 1;
    work->evaluations++;
    if (amount == 0) { work->best[0] = 0; return 0; }
    for (size_t i = 0; i < work->n; i++) {
        if (work->coins[i] > amount) { continue; }
        unsigned child = solve(work, amount - work->coins[i]);
        if (child != NO_CHANGE && child + 1 < work->best[amount]) {
            work->best[amount] = child + 1;
            work->choice[amount] = i;
        }
    }
    return work->best[amount];
}
static Change finish(const CoinWork *work, unsigned amount)
{
    Change next = {0};
    next.evaluations = work->evaluations;
    if (work->best[amount] == NO_CHANGE) { return next; }
    next.possible = 1; next.total = work->best[amount];
    unsigned remaining = amount;
    while (remaining != 0) {
        size_t coin = work->choice[remaining];
        next.counts[coin]++;
        remaining -= work->coins[coin];
    }
    return next;
}
DStatus min_change_memo(const unsigned *coins, size_t n, unsigned amount, Change *out)
{
    DStatus status = validate(coins, n, amount, out);
    if (status != D_OK) { return status; }
    CoinWork work = begin(coins, n);
    (void)solve(&work, amount);
    *out = finish(&work, amount);
    return D_OK;
}
DStatus min_change_table(const unsigned *coins, size_t n, unsigned amount, Change *out)
{
    DStatus status = validate(coins, n, amount, out);
    if (status != D_OK) { return status; }
    CoinWork work = begin(coins, n);
    work.best[0] = 0; work.evaluations = 1;
    for (unsigned a = 1; a <= amount; a++) {
        work.evaluations++;
        for (size_t i = 0; i < n; i++) {
            if (coins[i] > a) { continue; }
            unsigned child = work.best[a - coins[i]];
            if (child != NO_CHANGE && child + 1 < work.best[a]) {
                work.best[a] = child + 1; work.choice[a] = i;
            }
        }
    }
    *out = finish(&work, amount);
    return D_OK;
}
