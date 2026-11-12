#include "sort_internal.h"
SortStatus sort_validate(const SItem *a, size_t n, const SortStats *out)
{
    if (out == NULL || (n != 0 && a == NULL)) { return S_INVALID; }
    return n > SORT_MAX ? S_RANGE : S_OK;
}
SortStatus sort_domain(const SItem *a, size_t n)
{
    for (size_t i = 0; i < n; i++) {
        if (a[i].key < SORT_LOW || a[i].key > SORT_HIGH) { return S_RANGE; }
    }
    return S_OK;
}
int sort_compare(int left, int right, SortStats *stats)
{
    stats->comparisons++;
    if (left < right) { return -1; }
    if (left > right) { return 1; }
    return 0;
}
void sort_write(SItem *a, size_t i, SItem value, SortStats *stats)
{
    a[i] = value;
    stats->writes++;
}
void sort_swap(SItem *a, size_t i, size_t j, SortStats *stats)
{
    if (i != j) {
        SItem saved = a[i];
        sort_write(a, i, a[j], stats);
        sort_write(a, j, saved, stats);
    }
}
