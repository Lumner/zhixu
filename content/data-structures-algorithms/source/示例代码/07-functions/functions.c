#include <stdio.h>

int add_minutes(int current, int extra);
void print_goal(void);

int main(void)
{
    int minutes = 30;
    int result = add_minutes(minutes, 15);
    printf("minutes=%d\nresult=%d\n", minutes, result);
    print_goal();
    return 0;
}

int add_minutes(int current, int extra)
{
    current = current + extra;
    return current;
}

void print_goal(void)
{
    puts("goal=60");
}
