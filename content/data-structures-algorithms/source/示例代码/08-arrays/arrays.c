#include <stdio.h>

#define CAPACITY 7

int main(void)
{
    int minutes[CAPACITY] = {30, 0, 45, 15, 60};
    int count = 5;
    int target = 45;

    if (count == 0) {
        puts("empty");
        return 0;
    }

    int total = 0;
    int minimum = minutes[0];
    int maximum = minutes[0];
    int active = 0;
    int first = -1;

    for (int i = 0; i < count; i++) {
        int value = minutes[i];
        total += value;
        if (value < minimum) {
            minimum = value;
        }
        if (value > maximum) {
            maximum = value;
        }
        if (value > 0) {
            active++;
        }
        if (value == target && first == -1) {
            first = i;
        }
    }

    printf("count=%d total=%d min=%d max=%d\n", count, total, minimum, maximum);
    printf("average=%.2f active=%d first=%d\n", (double)total / count, active, first);
    return 0;
}
