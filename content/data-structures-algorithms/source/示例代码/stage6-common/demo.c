#include "demo.h"
#include <stdio.h>
void demo_print(const char *name, const SItem *a, size_t n, SortStats stats)
{
    printf("%s comparisons=%zu writes=%zu\n", name, stats.comparisons, stats.writes);
    for (size_t i = 0; i < n; i++) { printf("%s%d:%d", i == 0 ? "" : " ", a[i].key, a[i].tag); }
    putchar('\n');
}
