#include <stdio.h>
#include <string.h>

int main(void) {
    int minutes[] = {15, 25, 35, 45};
    size_t count = sizeof minutes / sizeof minutes[0];
    int total = 0;
    for (size_t i = 0; i < count; i++) { total += minutes[i]; }
    char title[16] = "OS lab";
    printf("count=%zu sum=%d length=%zu\n", count, total, strlen(title));
    return 0;
}
