#include "doubly.h"
#include <stdio.h>

int main(void)
{
    DList list;
    dlist_init(&list);
    int failed = dlist_insert(&list, 0, 10) != DS_OK || dlist_insert(&list, 1, 30) != DS_OK || dlist_insert(&list, 1, 20) != DS_OK;
    if (!failed) {
        for (DNode *node = list.root.next; node != &list.root; node = node->next) {
            printf("forward=%d\n", node->value);
        }
        for (DNode *node = list.root.previous; node != &list.root; node = node->previous) {
            printf("backward=%d\n", node->value);
        }
    }
    int removed = 0;
    if (!failed) {
        failed = dlist_erase(&list, 1, &removed) != DS_OK;
    }
    if (!failed) {
        printf("removed=%d count=%zu\n", removed, list.count);
    }
    dlist_clear(&list);
    return failed;
}
