#include "sort_internal.h"
static void quick_range(SItem *a, size_t lo, size_t hi, SortStats *stats)
{
    while (hi - lo > 1) {
        int pivot = a[lo + (hi - lo) / 2].key;
        size_t lt = lo, i = lo, gt = hi;
        while (i < gt) {
            int order = sort_compare(a[i].key, pivot, stats);
            if (order < 0) { sort_swap(a, lt, i, stats); lt++; i++; }
            else if (order > 0) { gt--; sort_swap(a, i, gt, stats); }
            else { i++; }
        }
        if (lt - lo < hi - gt) {
            quick_range(a, lo, lt, stats);
            lo = gt;
        }
        else {
            quick_range(a, gt, hi, stats);
            hi = lt;
        }
    }
}
SortStatus quick_sort(SItem *a, size_t n, SortStats *out)
{
    SortStatus status = sort_validate(a, n, out);
    if (status != S_OK) { return status; }
    SortStats stats = {0, 0};
    quick_range(a, 0, n, &stats);
    *out = stats;
    return S_OK;
}
