#include <stdio.h>

int main(void) {
    int total = 0;
    for (int day = 1; day <= 7; day++) {
        int minutes = day * 10;
        if (minutes >= 30) { total += minutes; }
    }
    printf("total=%d\n", total);
    return 0;
}
