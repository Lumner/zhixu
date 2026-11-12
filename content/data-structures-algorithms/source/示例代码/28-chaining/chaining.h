#ifndef DSA_CHAINING_H
#define DSA_CHAINING_H
#include "hash_status.h"
#define CHAIN_BUCKETS 8
typedef struct HNode { int key; int value; struct HNode *next; } HNode;
typedef struct { HNode *buckets[CHAIN_BUCKETS]; size_t count; } ChainMap;
void chain_init(ChainMap *map);
void chain_clear(ChainMap *map);
HStatus chain_put(ChainMap *map, int key, int value);
HStatus chain_get(const ChainMap *map, int key, int *out);
HStatus chain_set(ChainMap *map, int key, int value);
HStatus chain_erase(ChainMap *map, int key);
#endif
