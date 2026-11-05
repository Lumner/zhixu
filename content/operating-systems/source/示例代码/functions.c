#include <stdio.h>

int add_minutes(int left, int right) {
    return left + right;
}

int main(void) {
    int total = add_minutes(30, 60);
    printf("sum=%d\n", total);
    return 0;
}
