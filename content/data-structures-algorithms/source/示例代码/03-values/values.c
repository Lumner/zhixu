#include <stdio.h>

int main(void)
{
    const int minutes_per_hour = 60;
    int total_minutes = 135;
    int hours = total_minutes / minutes_per_hour;
    int remaining = total_minutes % minutes_per_hour;
    double average = (double)total_minutes / 2;
    char unit = 'm';

    printf("hours=%d\nremaining=%d\n", hours, remaining);
    printf("integer_average=%d\n", total_minutes / 2);
    printf("average=%.2f\nunit=%c\n", average, unit);

    total_minutes = total_minutes + 15;
    printf("new_total=%d\n", total_minutes);
    return 0;
}
