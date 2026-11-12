#include <stdio.h>
#include "knapsack.h"
int main(void)
{
    PackItem items[] = {{3,5}, {4,6}, {2,3}};
    PackResult result;
    unsigned rolling;
    if (pack01_table(items, 3, 6, &result) != D_OK ||
        pack01_rolling(items, 3, 6, &rolling) != D_OK) { return 1; }
    printf("value=%u cost=%u mask=%u rolling=%u\n",
           result.value, result.cost, result.mask, rolling);
    puts("ratio greedy on this sample: value=8, optimum=9");
    return 0;
}
