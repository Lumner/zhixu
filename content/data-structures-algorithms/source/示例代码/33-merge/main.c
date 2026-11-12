#include "demo.h"
int main(void)
{
    SItem a[] = {{3, 0}, {1, 1}, {2, 2}, {1, 3}, {3, 4}};
    SortStats stats;
    if (merge_sort(a, 5, &stats) != S_OK) { return 1; }
    demo_print("merge", a, 5, stats);
    return 0;
}
