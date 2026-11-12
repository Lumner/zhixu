#include <stdio.h>

long sum_recursive(unsigned int n)
{
    printf("enter n=%u\n", n);
    if (n == 0) {
        return 0;
    }
    long partial = sum_recursive(n - 1);
    long total = partial + (long)n;
    printf("leave n=%u total=%ld\n", n, total);
    return total;
}

long sum_iterative(unsigned int n)
{
    long total = 0;
    for (unsigned int i = 1; i <= n; i++) {
        total += i;
    }
    return total;
}

int main(void)
{
    unsigned int n = 3;
    long recursive = sum_recursive(n);
    long iterative = sum_iterative(n);
    printf("recursive=%ld iterative=%ld\n", recursive, iterative);
    return 0;
}
