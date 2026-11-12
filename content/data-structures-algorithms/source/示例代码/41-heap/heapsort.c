#include "heapsort.h"
#include "sort_internal.h"
static void down_max(SItem *a, size_t root, size_t n, SortStats *stats)
{
    while (root < n / 2) {
        size_t child = root * 2 + 1;
        if (child + 1 < n && sort_compare(a[child + 1].key, a[child].key, stats) > 0) { child++; }
        if (sort_compare(a[root].key, a[child].key, stats) >= 0) { break; }
        sort_swap(a, root, child, stats); root = child;
    }
}
SortStatus heap_sort(SItem *a, size_t n, SortStats *out)
{
    SortStatus status = sort_validate(a, n, out);
    if (status != S_OK) { return status; }
    SortStats stats = {0, 0};
    for (size_t i = n / 2; i > 0; i--) { down_max(a, i - 1, n, &stats); }
    for (size_t end = n; end > 1; end--) {
        sort_swap(a, 0, end - 1, &stats); down_max(a, 0, end - 1, &stats);
    }
    *out = stats; return S_OK;
}
