#include "subset.h"
typedef struct {
    const unsigned *values;
    size_t n;
    unsigned target, mask, suffix[D_ITEMS + 1];
    int pruning;
    SubsetResult *result;
} Search;
static void visit(Search *search, size_t i, unsigned sum)
{
    search->result->nodes++;
    if (search->pruning &&
        (sum > search->target || search->target - sum > search->suffix[i])) {
        search->result->pruned++;
        return;
    }
    if (i == search->n) {
        if (sum == search->target) {
            search->result->masks[search->result->count++] = search->mask;
        }
        return;
    }
    unsigned saved = search->mask;
    search->mask |= 1u << i;
    visit(search, i + 1, sum + search->values[i]);
    search->mask = saved;
    visit(search, i + 1, sum);
}
DStatus subset_sums(const unsigned *values, size_t n, unsigned target,
                    int pruning, SubsetResult *out)
{
    if (out == NULL || (n != 0 && values == NULL) || (pruning != 0 && pruning != 1)) {
        return D_INVALID;
    }
    if (n > D_ITEMS || target > D_SUB_TARGET) { return D_RANGE; }
    for (size_t i = 0; i < n; i++) {
        if (values[i] > D_SUB_VALUE) { return D_RANGE; }
    }
    SubsetResult next = {0};
    Search search = {0};
    search.values = values; search.n = n; search.target = target;
    search.pruning = pruning; search.result = &next;
    for (size_t i = n; i > 0; i--) {
        search.suffix[i - 1] = search.suffix[i] + values[i - 1];
    }
    visit(&search, 0, 0);
    *out = next;
    return D_OK;
}
