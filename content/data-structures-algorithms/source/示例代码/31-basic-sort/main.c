#include "demo.h"
int main(void)
{
    SItem a[] = {{2, 10}, {2, 11}, {1, 12}};
    SItem b[] = {{2, 10}, {2, 11}, {1, 12}};
    SortStats stats;
    if (selection_sort(a, 3, &stats) != S_OK) { return 1; }
    demo_print("selection", a, 3, stats);
    if (bubble_sort(b, 3, &stats) != S_OK) { return 1; }
    demo_print("bubble", b, 3, stats);
    return 0;
}
