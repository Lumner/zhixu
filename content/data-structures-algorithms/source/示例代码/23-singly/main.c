#include "singly.h"
#include <stdio.h>

int main(void)
{
    SList list;
    slist_init(&list);
    int failed = slist_insert(&list, 0, 10) != DS_OK || slist_insert(&list, 1, 30) != DS_OK || slist_insert(&list, 1, 20) != DS_OK;
    int removed = 0;
    if (!failed) {
        failed = slist_erase(&list, 0, &removed) != DS_OK;
    }
    if (!failed) {
        printf("removed=%d count=%zu\n", removed, list.count);
        for (size_t i = 0; i < list.count; i++) {
            int value = 0;
            if (slist_get(&list, i, &value) != DS_OK) {
                failed = 1;
                break;
            }
            printf("[%zu]=%d\n", i, value);
        }
    }
    slist_clear(&list);
    return failed;
}
