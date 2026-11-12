#include "vector.h"
#include <stdio.h>

int main(void)
{
    Vector growing, exact;
    vec_init(&growing);
    vec_init(&exact);
    size_t growing_copies = 0, exact_copies = 0;
    int failed = 0;
    for (int value = 0; value < 17; value++) {
        if (growing.count == growing.capacity) {
            growing_copies += growing.count;
        }
        exact_copies += exact.count;
        if (vec_insert(&growing, growing.count, value) != DS_OK ||
            vec_reserve(&exact, exact.count + 1) != DS_OK ||
            vec_insert(&exact, exact.count, value) != DS_OK) {
            failed = 1;
            break;
        }
    }
    if (!failed) {
        printf("doubling count=%zu capacity=%zu copy_model=%zu\n", growing.count, growing.capacity, growing_copies);
        printf("exact count=%zu capacity=%zu copy_model=%zu\n", exact.count, exact.capacity, exact_copies);
    }
    vec_clear(&growing);
    vec_clear(&exact);
    return failed;
}
