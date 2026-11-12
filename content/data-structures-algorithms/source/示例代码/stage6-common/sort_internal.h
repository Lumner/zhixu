#ifndef DSA_SORT_INTERNAL_H
#define DSA_SORT_INTERNAL_H
#include "sort.h"
SortStatus sort_validate(const SItem *a, size_t n, const SortStats *out);
SortStatus sort_domain(const SItem *a, size_t n);
int sort_compare(int left, int right, SortStats *stats);
void sort_write(SItem *a, size_t i, SItem value, SortStats *stats);
void sort_swap(SItem *a, size_t i, size_t j, SortStats *stats);
#endif
