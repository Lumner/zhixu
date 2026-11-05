#include <stdio.h>

void swap(int *left, int *right) {
    int saved = *left;
    *left = *right;
    *right = saved;
}

int main(void) {
    int a = 10;
    int b = 20;
    printf("before=%d,%d\n", a, b);
    swap(&a, &b);
    printf("after=%d,%d\n", a, b);
    return 0;
}
