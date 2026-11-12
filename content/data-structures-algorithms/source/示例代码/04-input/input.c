#include <stdio.h>

int main(void)
{
    int digit = getchar();
    int ending = getchar();

    if (digit < '0' || digit > '9') {
        puts("invalid input");
        return 1;
    }
    if (ending != '\n' && ending != EOF) {
        puts("invalid input");
        return 1;
    }

    int hours = digit - '0';
    printf("hours=%d\nminutes=%d\n", hours, hours * 60);
    return 0;
}
