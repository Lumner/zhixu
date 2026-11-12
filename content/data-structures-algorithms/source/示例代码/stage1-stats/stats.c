#include <stdio.h>

#define CAPACITY 7
#define MAX_MINUTES 1440

int read_bounded(int limit);

int main(void)
{
    int minutes[CAPACITY] = {0};
    int count = read_bounded(CAPACITY);
    if (count < 0) {
        puts("invalid count");
        return 1;
    }
    if (count == 0) {
        puts("count=0\nempty");
        return 0;
    }

    for (int i = 0; i < count; i++) {
        int value = read_bounded(MAX_MINUTES);
        if (value < 0) {
            puts("invalid minutes");
            return 1;
        }
        minutes[i] = value;
    }
    int target = read_bounded(MAX_MINUTES);
    if (target < 0) {
        puts("invalid target");
        return 1;
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

    printf("count=%d\ntotal=%d\nmin=%d\nmax=%d\n", count, total, minimum, maximum);
    printf("average=%.2f\nactive=%d\n", (double)total / count, active);
    if (active == 0) {
        puts("active_average=NA");
    } else {
        printf("active_average=%.2f\n", (double)total / active);
    }
    printf("first=%d\n", first);
    return 0;
}

int read_bounded(int limit)
{
    int ch = getchar();
    int value = 0;
    int has_digit = 0;
    int valid = 1;

    while (ch != '\n' && ch != EOF) {
        if (ch < '0' || ch > '9') {
            valid = 0;
        } else {
            int digit = ch - '0';
            has_digit = 1;
            if (value > limit / 10 ||
                (value == limit / 10 && digit > limit % 10)) {
                valid = 0;
            }
            if (valid) {
                value = value * 10 + digit;
            }
        }
        ch = getchar();
    }
    if (!valid || !has_digit) {
        return -1;
    }
    return value;
}
