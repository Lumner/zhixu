#include "queue.h"
#include <stdio.h>
int main(void)
{
    Queue ring;
    LinkedQueue linked;
    if (queue_init(&ring, 3) != DS_OK) {
        return 1;
    }
    lqueue_init(&linked);
    int failed = queue_push(&ring, 10) != DS_OK || queue_push(&ring, 20) != DS_OK ||
        lqueue_push(&linked, 10) != DS_OK || lqueue_push(&linked, 20) != DS_OK;
    int a = 0, b = 0;
    if (!failed) {
        failed = queue_pop(&ring, &a) != DS_OK || lqueue_pop(&linked, &b) != DS_OK;
    }
    if (!failed) {
        printf("first=%d,%d\n", a, b);
    }
    if (!failed) failed = queue_push(&ring, 30) != DS_OK || queue_push(&ring, 40) != DS_OK ||
        lqueue_push(&linked, 30) != DS_OK || lqueue_push(&linked, 40) != DS_OK;
    for (int i = 0; i < 3 && !failed; i++) {
        failed = queue_pop(&ring, &a) != DS_OK || lqueue_pop(&linked, &b) != DS_OK;
        if (!failed) {
            printf("next=%d,%d\n", a, b);
        }
    }
    if (!failed) {
        printf("linked_empty=%d\n", linked.head == NULL && linked.tail == NULL);
    }
    lqueue_clear(&linked);
    return failed;
}
