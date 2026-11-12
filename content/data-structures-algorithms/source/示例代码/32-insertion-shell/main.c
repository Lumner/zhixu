#include "demo.h"
int main(void)
{
    SItem a[] = {{1, 0}, {2, 1}, {3, 2}, {4, 3}};
    SItem b[] = {{4, 0}, {3, 1}, {2, 2}, {1, 3}};
    SItem c[] = {{2, 10}, {2, 11}, {1, 12}, {2, 13}};
    SortStats stats;
    if (insertion_sort(a, 4, &stats) != S_OK) { return 1; }
    demo_print("insertion-sorted", a, 4, stats);
    if (insertion_sort(b, 4, &stats) != S_OK) { return 1; }
    demo_print("insertion-reverse", b, 4, stats);
    if (shell_sort(c, 4, &stats) != S_OK) { return 1; }
    demo_print("shell", c, 4, stats);
    return 0;
}
