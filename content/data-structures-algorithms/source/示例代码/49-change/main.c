#include <stdio.h>
#include "coins.h"
int main(void)
{
    unsigned coins[] = {4,3,1};
    Change result = {0};
    if (greedy_change(coins, 3, 6, &result) != D_OK) { return 1; }
    printf("greedy total=%zu counts=%u,%u,%u\n", result.total,
           result.counts[0], result.counts[1], result.counts[2]);
    puts("manual better: 3+3 uses 2 coins");
    unsigned no_one[] = {4,3};
    result.total = 99;
    DStatus status = greedy_change(no_one, 2, 6, &result);
    printf("stuck=%d old_total=%zu\n", status == D_STUCK, result.total);
    return status == D_STUCK ? 0 : 1;
}
