#include <stdio.h>
#include "sum.h"

int main(void) {
    int numbers[5] = {3, -2, 7, 0, 4};
    int answer = sum(numbers, 5);
    printf("sum = %d\n", answer);
    return 0;
}
