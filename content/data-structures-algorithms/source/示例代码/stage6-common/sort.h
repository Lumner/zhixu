#ifndef DSA_SORT_H
#define DSA_SORT_H
#include <stddef.h>
#define SORT_MAX 128
#define SORT_LOW (-999)
#define SORT_HIGH 999
typedef struct { int key; int tag; } SItem;
typedef struct { size_t comparisons; size_t writes; } SortStats;
typedef enum { S_OK, S_INVALID, S_RANGE, S_MEMORY } SortStatus;
SortStatus selection_sort(SItem *a, size_t n, SortStats *out);
SortStatus bubble_sort(SItem *a, size_t n, SortStats *out);
SortStatus insertion_sort(SItem *a, size_t n, SortStats *out);
SortStatus shell_sort(SItem *a, size_t n, SortStats *out);
SortStatus merge_sort(SItem *a, size_t n, SortStats *out);
SortStatus quick_sort(SItem *a, size_t n, SortStats *out);
SortStatus counting_sort(SItem *a, size_t n, SortStats *out);
SortStatus bucket_sort(SItem *a, size_t n, SortStats *out);
SortStatus radix_sort(SItem *a, size_t n, SortStats *out);
#endif
