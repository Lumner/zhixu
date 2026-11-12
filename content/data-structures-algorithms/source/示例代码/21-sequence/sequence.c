#include "sequence.h"

void seq_init(Sequence *list) {
    list->count = 0;
}

DsStatus seq_get(const Sequence *list, size_t position, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (position >= list->count) {
        return DS_RANGE;
    }
    *out = list->data[position];
    return DS_OK;
}

DsStatus seq_set(Sequence *list, size_t position, int value)
{
    if (position >= list->count) {
        return DS_RANGE;
    }
    list->data[position] = value;
    return DS_OK;
}

DsStatus seq_insert(Sequence *list, size_t position, int value)
{
    if (position > list->count) {
        return DS_RANGE;
    }
    if (list->count == SEQ_CAPACITY) {
        return DS_FULL;
    }
    for (size_t i = list->count; i > position; i--) {
        list->data[i] = list->data[i - 1];
    }
    list->data[position] = value;
    list->count++;
    return DS_OK;
}

DsStatus seq_erase(Sequence *list, size_t position, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (position >= list->count) {
        return DS_RANGE;
    }
    int saved = list->data[position];
    for (size_t i = position; i + 1 < list->count; i++) {
        list->data[i] = list->data[i + 1];
    }
    list->count--;
    *out = saved;
    return DS_OK;
}
