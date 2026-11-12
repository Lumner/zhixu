#include "search.h"

int is_nondecreasing(const int *values, size_t count)
{
    for (size_t i = 1; i < count; i++) {
        if (values[i] < values[i - 1]) {
            return 0;
        }
    }
    return 1;
}

SearchResult linear_find(const int *values, size_t count, int target)
{
    SearchResult result = {count, 0};
    for (size_t i = 0; i < count; i++) {
        result.comparisons++;
        if (values[i] == target) {
            result.index = i;
            break;
        }
    }
    return result;
}

SearchResult lower_bound_int(const int *values, size_t count, int target)
{
    size_t lo = 0;
    size_t hi = count;
    SearchResult result = {count, 0};
    while (lo < hi) {
        size_t mid = lo + (hi - lo) / 2;
        result.comparisons++;
        if (values[mid] < target) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    result.index = lo;
    return result;
}

SearchResult binary_find_first(const int *values, size_t count, int target)
{
    SearchResult result = lower_bound_int(values, count, target);
    if (result.index < count) {
        result.comparisons++;
        if (values[result.index] == target) {
            return result;
        }
    }
    result.index = count;
    return result;
}
