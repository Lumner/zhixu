#include "stack.h"
#include <stdio.h>

int main(void)
{
    ArrayStack array;
    LinkedStack linked;
    stack_init(&array);
    lstack_init(&linked);
    int failed = stack_push(&array, 10) != DS_OK || stack_push(&array, 20) != DS_OK ||
        lstack_push(&linked, 10) != DS_OK || lstack_push(&linked, 20) != DS_OK;
    int a = 0, b = 0;
    if (!failed) {
        failed = stack_pop(&array, &a) != DS_OK || lstack_pop(&linked, &b) != DS_OK;
    }
    if (!failed) {
        printf("array_pop=%d linked_pop=%d\n", a, b);
    }
    lstack_clear(&linked);
    return failed;
}
