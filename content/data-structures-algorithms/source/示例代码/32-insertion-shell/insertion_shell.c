#include "sort_internal.h"
SortStatus insertion_sort(SItem *a, size_t n, SortStats *out)
{
    SortStatus status = sort_validate(a, n, out);
    if (status != S_OK) { return status; }
    SortStats stats = {0, 0};
    for (size_t i = 1; i < n; i++) {
        SItem saved = a[i];
        size_t j = i;
        while (j > 0 && sort_compare(a[j - 1].key, saved.key, &stats) > 0) {
            sort_write(a, j, a[j - 1], &stats);
            j--;
        }
        sort_write(a, j, saved, &stats);
    }
    *out = stats;
    return S_OK;
}
SortStatus shell_sort(SItem *a, size_t n, SortStats *out)
{
    SortStatus status = sort_validate(a, n, out);
    if (status != S_OK) { return status; }
    SortStats stats = {0, 0};
    for (size_t gap = n / 2; gap > 0; gap /= 2) {
        for (size_t i = gap; i < n; i++) {
            SItem saved = a[i];
            size_t j = i;
            while (j >= gap && sort_compare(a[j - gap].key, saved.key, &stats) > 0) {
                sort_write(a, j, a[j - gap], &stats);
                j -= gap;
            }
            sort_write(a, j, saved, &stats);
        }
    }
    *out = stats;
    return S_OK;
}
