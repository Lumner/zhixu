/* Model: all arrivals are 0, FCFS order A/B/C, no context-switch cost. */
#include <stdio.h>

int main(void) {
    const int burst[] = {5, 3, 1};
    int now = 0;
    int sum_wait = 0;
    for (int i = 0; i < 3; i++) {
        int wait = now;
        now += burst[i];
        sum_wait += wait;
        printf("%c wait=%d turnaround=%d\n", 'A' + i, wait, now);
    }
    printf("average_wait=%.3f\n", sum_wait / 3.0);
    return 0;
}
