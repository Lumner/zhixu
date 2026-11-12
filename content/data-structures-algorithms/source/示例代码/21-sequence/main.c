#include "sequence.h"
#include <stdio.h>

int main(void)
{
    Sequence list;
    seq_init(&list);
    if (seq_insert(&list, 0, 10) != DS_OK || seq_insert(&list, 1, 30) != DS_OK ||
        seq_insert(&list, 1, 20) != DS_OK) return 1;
    int removed = 0;
    if (seq_erase(&list, 0, &removed) != DS_OK) {
        return 1;
    }
    printf("removed=%d count=%zu\n", removed, list.count);
    for (size_t i = 0; i < list.count; i++) {
        int value = 0;
        if (seq_get(&list, i, &value) != DS_OK) {
            return 1;
        }
        printf("[%zu]=%d\n", i, value);
    }
    return 0;
}
