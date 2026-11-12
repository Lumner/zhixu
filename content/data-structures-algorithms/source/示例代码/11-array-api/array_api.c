#include <stdio.h>

int sum_minutes(const int values[], size_t count, int *out_total)
{
    if (out_total == NULL || count > 7 || (count > 0 && values == NULL)) {
        return 0;
    }
    int total = 0;
    for (size_t i = 0; i < count; i++) {
        if (values[i] < 0 || values[i] > 1440) {
            return 0;
        }
        total += values[i];
    }
    *out_total = total;
    return 1;
}

int main(void)
{
    int minutes[] = {10, 20, 30};
    size_t count = sizeof minutes / sizeof minutes[0];
    int total = -1;
    if (!sum_minutes(minutes, count, &total)) {
        return 1;
    }
    printf("count=%zu total=%d first=%d\n", count, total, minutes[0]);
    int grid[2][3] = {{1, 2, 3}, {4, 5, 6}};
    printf("grid=%d\n", grid[1][2]);
    if (!sum_minutes(NULL, 0, &total)) {
        return 1;
    }
    printf("empty_total=%d\n", total);
    return 0;
}
