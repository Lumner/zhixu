#ifndef DSA_OPEN_MAP_H
#define DSA_OPEN_MAP_H
#include "hash_status.h"
typedef enum { SLOT_EMPTY, SLOT_LIVE, SLOT_DELETED } SlotState;
typedef struct { SlotState state; int key; int value; } HSlot;
typedef struct { HSlot *slots; size_t capacity; size_t count; size_t used; } OpenMap;
void open_init(OpenMap *map);
void open_clear(OpenMap *map);
HStatus open_rehash(OpenMap *map, size_t capacity);
HStatus open_put(OpenMap *map, int key, int value);
HStatus open_get(const OpenMap *map, int key, int *out);
HStatus open_set(OpenMap *map, int key, int value);
HStatus open_erase(OpenMap *map, int key);
#endif
