#include "demo.h"
int main(void)
{
    SItem a[] = {{2, 10}, {2, 11}, {1, 12}};
    SItem b[] = {{5, 0}, {5, 1}, {5, 2}, {5, 3}};
    SortStats stats;
    if (quick_sort(a, 3, &stats) != S_OK) { return 1; }
    demo_print("quick", a, 3, stats);
    if (quick_sort(b, 4, &stats) != S_OK) { return 1; }
    demo_print("quick-equal", b, 4, stats);
    return 0;
}
