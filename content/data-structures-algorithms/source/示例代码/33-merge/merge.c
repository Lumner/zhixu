#include "sort_internal.h"
#include <stdlib.h>
static void merge_range(SItem *a, SItem *work, size_t lo, size_t hi, SortStats *stats)
{
    if (hi - lo < 2) { return; }
    size_t mid = lo + (hi - lo) / 2;
    merge_range(a, work, lo, mid, stats);
    merge_range(a, work, mid, hi, stats);
    size_t left = lo, right = mid, dest = lo;
    while (left < mid && right < hi) {
        if (sort_compare(a[left].key, a[right].key, stats) <= 0) {
            sort_write(work, dest++, a[left++], stats);
        }
        else { sort_write(work, dest++, a[right++], stats); }
    }
    while (left < mid) { sort_write(work, dest++, a[left++], stats); }
    while (right < hi) { sort_write(work, dest++, a[right++], stats); }
    for (size_t i = lo; i < hi; i++) { sort_write(a, i, work[i], stats); }
}
SortStatus merge_sort(SItem *a, size_t n, SortStats *out)
{
    SortStatus status = sort_validate(a, n, out);
    if (status != S_OK) { return status; }
    SortStats stats = {0, 0};
    if (n > 1) {
        SItem *work = malloc(n * sizeof *work);
        if (work == NULL) { return S_MEMORY; }
        merge_range(a, work, 0, n, &stats);
        free(work);
    }
    *out = stats;
    return S_OK;
}
