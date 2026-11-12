#include <stdio.h>

int main(void)
{
    int n = 5;
    int total = 0;

    for (int i = 1; i <= n; i++) {
        total = total + i;
        printf("i=%d total=%d\n", i, total);
    }
    printf("sum=%d\n", total);
    return 0;
}
