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

    int blocks = digit - '0';
    if (blocks >= 8) {
        puts("excellent");
    } else if (blocks >= 5) {
        puts("keep-going");
    } else {
        puts("start-small");
    }
    return 0;
}
