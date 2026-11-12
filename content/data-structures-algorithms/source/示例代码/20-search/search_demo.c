#include "search.h"
#include <stdio.h>

int main(void)
{
    int values[] = {1, 3, 3, 3, 8, 12};
    size_t count = sizeof values / sizeof values[0];
    int target = 3;
    if (!is_nondecreasing(values, count)) {
        fputs("array is not sorted\n", stderr);
        return 1;
    }
    SearchResult linear = linear_find(values, count, target);
    SearchResult lower = lower_bound_int(values, count, target);
    SearchResult binary = binary_find_first(values, count, target);
    printf("linear index=%zu comparisons=%zu\n", linear.index, linear.comparisons);
    printf("lower index=%zu comparisons=%zu\n", lower.index, lower.comparisons);
    printf("binary index=%zu comparisons=%zu\n", binary.index, binary.comparisons);
    return 0;
}
