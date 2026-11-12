#include "vector.h"
#include <stdint.h>
#include <stdlib.h>

void vec_init(Vector *list)
{
    list->data = NULL;
    list->count = list->capacity = 0;
}

void vec_clear(Vector *list) {
    free(list->data);
    vec_init(list);
}

DsStatus vec_reserve(Vector *list, size_t capacity)
{
    if (capacity > DS_MAX_ITEMS) {
        return DS_FULL;
    }
    if (capacity <= list->capacity) {
        return DS_OK;
    }
    if (capacity > SIZE_MAX / sizeof *list->data) {
        return DS_MEMORY;
    }
    int *grown = realloc(list->data, capacity * sizeof *list->data);
    if (grown == NULL) {
        return DS_MEMORY;
    }
    list->data = grown;
    list->capacity = capacity;
    return DS_OK;
}

DsStatus vec_get(const Vector *list, size_t position, int *out)
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

DsStatus vec_set(Vector *list, size_t position, int value)
{
    if (position >= list->count) {
        return DS_RANGE;
    }
    list->data[position] = value;
    return DS_OK;
}

DsStatus vec_insert(Vector *list, size_t position, int value)
{
    if (position > list->count) {
        return DS_RANGE;
    }
    if (list->count == DS_MAX_ITEMS) {
        return DS_FULL;
    }
    if (list->count == list->capacity) {
        size_t next = list->capacity == 0 ? 4 : list->capacity * 2;
        if (next > DS_MAX_ITEMS) {
            next = DS_MAX_ITEMS;
        }
        DsStatus status = vec_reserve(list, next);
        if (status != DS_OK) {
            return status;
        }
    }
    for (size_t i = list->count; i > position; i--) {
        list->data[i] = list->data[i - 1];
    }
    list->data[position] = value;
    list->count++;
    return DS_OK;
}

DsStatus vec_erase(Vector *list, size_t position, int *out)
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
