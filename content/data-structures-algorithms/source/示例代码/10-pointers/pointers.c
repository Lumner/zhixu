#include <stdio.h>

void swap(int *left, int *right)
{
    if (left == NULL || right == NULL) {
        return;
    }
    int saved = *left;
    *left = *right;
    *right = saved;
}

int main(void)
{
    int a = 10;
    int b = 20;
    int *p = &a;
    *p = 15;
    printf("before=%d,%d\n", a, b);
    swap(&a, &b);
    printf("after=%d,%d\n", a, b);
    p = &b;
    *p = 30;
    printf("rebound=%d,%d\n", a, b);
    swap(NULL, &b);
    printf("null_call=%d,%d\n", a, b);
    return 0;
}
