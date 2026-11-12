#include "prefix_stats.h"
#include <stdio.h>

int main(void)
{
    int values[] = {30, 0, 45, 15, 45};
    size_t count = sizeof values / sizeof values[0];
    PrefixStats stats = {0, 0, 0};
    if (!prefix_stats(values, count, &stats)) {
        fputs("invalid statistics input\n", stderr);
        return 1;
    }
    printf("total=%ld maximum=%d first_max=%zu\n",
           stats.total, stats.maximum, stats.first_max);
    return 0;
}
