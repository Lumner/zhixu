#include <stdio.h>

unsigned long move_tower(unsigned int n, char from, char spare, char to)
{
    if (n == 0) {
        return 0;
    }
    unsigned long left = move_tower(n - 1, from, to, spare);
    printf("disk=%u %c->%c\n", n, from, to);
    unsigned long right = move_tower(n - 1, spare, from, to);
    return left + 1 + right;
}

int main(int argc, char *argv[])
{
    if (argc != 2 || argv[1][0] < '0' || argv[1][0] > '8' || argv[1][1] != '\0') {
        fputs("usage: hanoi n (one digit 0..8)\n", stderr);
        return 1;
    }
    unsigned int n = (unsigned int)(argv[1][0] - '0');
    unsigned long moves = move_tower(n, 'A', 'B', 'C');
    printf("moves=%lu\n", moves);
    return 0;
}
