#include "heapsort.h"
#include "demo.h"
int main(void)
{
    SItem a[] = {{2,10},{2,11},{1,12}}; SortStats stats;
    if (heap_sort(a, 3, &stats) != S_OK) { return 1; }
    demo_print("heap-sort", a, 3, stats); return 0;
}
