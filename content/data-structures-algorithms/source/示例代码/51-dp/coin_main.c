#include <stdio.h>
#include "coins.h"
int main(void)
{
    unsigned coins[] = {4,3,1};
    Change memo, table;
    if (min_change_memo(coins, 3, 6, &memo) != D_OK ||
        min_change_table(coins, 3, 6, &table) != D_OK) { return 1; }
    printf("memo total=%zu states=%lu\n", memo.total, memo.evaluations);
    printf("table total=%zu counts=%u,%u,%u states=%lu\n", table.total,
           table.counts[0], table.counts[1], table.counts[2], table.evaluations);
    unsigned even[] = {4,2};
    if (min_change_table(even, 2, 3, &table) != D_OK) { return 1; }
    printf("amount3 possible=%d\n", table.possible);
    return 0;
}
