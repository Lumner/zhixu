#include "open_map.h"
#include <stdlib.h>

static size_t locate(const OpenMap *map, int key)
{
    if (map->capacity == 0) {
        return 0;
    }
    size_t start = (size_t)key % map->capacity;
    for (size_t step = 0; step < map->capacity; step++) {
        size_t i = (start + step) % map->capacity;
        if (map->slots[i].state == SLOT_EMPTY) {
            break;
        }
        if (map->slots[i].state == SLOT_LIVE && map->slots[i].key == key) {
            return i;
        }
    }
    return map->capacity;
}
static void place(OpenMap *map, int key, int value)
{
    size_t start = (size_t)key % map->capacity;
    for (size_t step = 0; step < map->capacity; step++) {
        size_t i = (start + step) % map->capacity;
        if (map->slots[i].state != SLOT_LIVE) {
            if (map->slots[i].state == SLOT_EMPTY) {
                map->used++;
            }
            map->slots[i].state = SLOT_LIVE;
            map->slots[i].key = key;
            map->slots[i].value = value;
            map->count++;
            return;
        }
    }
}
void open_init(OpenMap *map)
{
    map->slots = NULL;
    map->capacity = map->count = map->used = 0;
}
void open_clear(OpenMap *map)
{
    free(map->slots);
    open_init(map);
}
HStatus open_rehash(OpenMap *map, size_t capacity)
{
    if ((capacity != 8 && capacity != 16 && capacity != 32 && capacity != 64) ||
        map->count > capacity * 3 / 4) {
        return H_INVALID;
    }
    HSlot *slots = calloc(capacity, sizeof *slots);
    if (slots == NULL) {
        return H_MEMORY;
    }
    OpenMap next = {slots, capacity, 0, 0};
    for (size_t i = 0; i < map->capacity; i++) {
        if (map->slots[i].state == SLOT_LIVE) {
            place(&next, map->slots[i].key, map->slots[i].value);
        }
    }
    free(map->slots);
    *map = next;
    return H_OK;
}
HStatus open_put(OpenMap *map, int key, int value)
{
    if (key < 0 || key > H_KEY_MAX) {
        return H_INVALID;
    }
    if (locate(map, key) != map->capacity) {
        return H_DUPLICATE;
    }
    if (map->count == H_MAX_ITEMS) {
        return H_FULL;
    }
    size_t target = map->capacity;
    if (target == 0) {
        target = 8;
    }
    else if (map->count + 1 > target * 3 / 4) {
        target *= 2;
    }
    if (target != map->capacity || map->used + 1 > target * 3 / 4) {
        HStatus status = open_rehash(map, target);
        if (status != H_OK) {
            return status;
        }
    }
    place(map, key, value);
    return H_OK;
}
HStatus open_get(const OpenMap *map, int key, int *out)
{
    if (key < 0 || key > H_KEY_MAX || out == NULL) {
        return H_INVALID;
    }
    size_t i = locate(map, key);
    if (i == map->capacity) {
        return H_MISSING;
    }
    *out = map->slots[i].value;
    return H_OK;
}
HStatus open_set(OpenMap *map, int key, int value)
{
    if (key < 0 || key > H_KEY_MAX) {
        return H_INVALID;
    }
    size_t i = locate(map, key);
    if (i == map->capacity) {
        return H_MISSING;
    }
    map->slots[i].value = value;
    return H_OK;
}
HStatus open_erase(OpenMap *map, int key)
{
    if (key < 0 || key > H_KEY_MAX) {
        return H_INVALID;
    }
    size_t i = locate(map, key);
    if (i == map->capacity) {
        return H_MISSING;
    }
    map->slots[i].state = SLOT_DELETED;
    map->count--;
    return H_OK;
}
