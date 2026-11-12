#include "demo.h"
#include <string.h>
int main(void)
{
    const SItem original[] = {{-9, 0}, {4, 1}, {-9, 2}, {0, 3}, {12, 4}};
    SItem a[5]; SortStats stats;
    memcpy(a, original, sizeof a);
    if (counting_sort(a, 5, &stats) != S_OK) { return 1; }
    demo_print("counting", a, 5, stats);
    memcpy(a, original, sizeof a);
    if (bucket_sort(a, 5, &stats) != S_OK) { return 1; }
    demo_print("bucket", a, 5, stats);
    memcpy(a, original, sizeof a);
    if (radix_sort(a, 5, &stats) != S_OK) { return 1; }
    demo_print("radix", a, 5, stats);
    return 0;
}
