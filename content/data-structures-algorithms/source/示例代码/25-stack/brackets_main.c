#include "brackets.h"
#include <stdio.h>
int main(int argc, char *argv[])
{
    if (argc != 2) {
        fputs("usage: brackets text\n", stderr);
        return 1;
    }
    size_t position = 0;
    BracketStatus status = brackets_check(argv[1], &position);
    if (status != B_OK) {
        fprintf(stderr, "%s position=%zu\n", brackets_status_name(status), position);
        return 1;
    }
    puts("ok");
    return 0;
}
