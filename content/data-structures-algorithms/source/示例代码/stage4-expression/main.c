#include "expression.h"
#include <stdio.h>
int main(int argc, char *argv[])
{
    if (argc != 2) {
        fputs("usage: expression quoted-postfix\n", stderr);
        return 1;
    }
    int value = 0;
    size_t token = 0;
    ExprStatus status = expression_evaluate(argv[1], &value, &token);
    if (status != E_OK) {
        fprintf(stderr, "expression: %s token=%zu\n", expression_status_name(status), token);
        return 1;
    }
    printf("result=%d\n", value);
    return 0;
}
