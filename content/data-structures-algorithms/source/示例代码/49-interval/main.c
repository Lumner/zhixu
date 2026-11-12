#include <stdio.h>
#include "interval.h"
int main(void)
{
    Activity items[] = {{10,0,6}, {20,1,3}, {30,3,5}, {40,5,7}, {50,7,8}};
    Schedule result;
    if (activity_select(items, 5, &result) != D_OK) { return 1; }
    printf("count=%zu ids=", result.count);
    for (size_t i = 0; i < result.count; i++) {
        printf("%s%u", i == 0 ? "" : ",", result.ids[i]);
    }
    puts("");
    return 0;
}
