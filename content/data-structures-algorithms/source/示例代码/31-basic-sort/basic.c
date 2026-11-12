#include "sort_internal.h"
SortStatus selection_sort(SItem *a, size_t n, SortStats *out)
{
    SortStatus status = sort_validate(a, n, out);
    if (status != S_OK) { return status; }
    SortStats stats = {0, 0};
    for (size_t i = 0; i + 1 < n; i++) {
        size_t best = i;
        for (size_t j = i + 1; j < n; j++) {
            if (sort_compare(a[j].key, a[best].key, &stats) < 0) { best = j; }
        }
        sort_swap(a, i, best, &stats);
    }
    *out = stats;
    return S_OK;
}
SortStatus bubble_sort(SItem *a, size_t n, SortStats *out)
{
    SortStatus status = sort_validate(a, n, out);
    if (status != S_OK) { return status; }
    SortStats stats = {0, 0};
    for (size_t end = n; end > 1; end--) {
        int changed = 0;
        for (size_t j = 1; j < end; j++) {
            if (sort_compare(a[j - 1].key, a[j].key, &stats) > 0) {
                sort_swap(a, j - 1, j, &stats);
                changed = 1;
            }
        }
        if (!changed) { break; }
    }
    *out = stats;
    return S_OK;
}
