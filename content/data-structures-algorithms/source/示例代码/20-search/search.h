#ifndef DSA_SEARCH_H
#define DSA_SEARCH_H

#include <stddef.h>

typedef struct {
    size_t index;
    size_t comparisons;
} SearchResult;

int is_nondecreasing(const int *values, size_t count);
SearchResult linear_find(const int *values, size_t count, int target);
SearchResult lower_bound_int(const int *values, size_t count, int target);
SearchResult binary_find_first(const int *values, size_t count, int target);

#endif
