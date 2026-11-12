#include "knapsack.h"
static DStatus validate(const PackItem *items, size_t n, unsigned budget, const void *out)
{
    if (out == NULL || (n != 0 && items == NULL)) { return D_INVALID; }
    if (n > D_ITEMS || budget > D_LIMIT) { return D_RANGE; }
    for (size_t i = 0; i < n; i++) {
        if (items[i].cost == 0 || items[i].cost > D_LIMIT || items[i].value > D_VALUE) {
            return D_RANGE;
        }
    }
    return D_OK;
}
DStatus pack01_table(const PackItem *items, size_t n, unsigned budget, PackResult *out)
{
    DStatus status = validate(items, n, budget, out);
    if (status != D_OK) { return status; }
    unsigned best[D_ITEMS + 1][D_LIMIT + 1] = {{0}};
    for (size_t i = 1; i <= n; i++) {
        PackItem item = items[i - 1];
        for (unsigned cap = 0; cap <= budget; cap++) {
            best[i][cap] = best[i - 1][cap];
            if (item.cost <= cap) {
                unsigned candidate = best[i - 1][cap - item.cost] + item.value;
                if (candidate > best[i][cap]) { best[i][cap] = candidate; }
            }
        }
    }
    PackResult next = {0};
    next.value = best[n][budget];
    unsigned cap = budget;
    for (size_t i = n; i > 0; i--) {
        if (best[i][cap] != best[i - 1][cap]) {
            next.mask |= 1u << (i - 1);
            next.cost += items[i - 1].cost;
            cap -= items[i - 1].cost;
        }
    }
    *out = next;
    return D_OK;
}
DStatus pack01_rolling(const PackItem *items, size_t n, unsigned budget, unsigned *out)
{
    DStatus status = validate(items, n, budget, out);
    if (status != D_OK) { return status; }
    unsigned best[D_LIMIT + 1] = {0};
    for (size_t i = 0; i < n; i++) {
        for (unsigned cap = budget; cap >= items[i].cost; cap--) {
            unsigned candidate = best[cap - items[i].cost] + items[i].value;
            if (candidate > best[cap]) { best[cap] = candidate; }
        }
    }
    *out = best[budget];
    return D_OK;
}
