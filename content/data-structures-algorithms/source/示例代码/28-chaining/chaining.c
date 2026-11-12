#include "chaining.h"
#include <stdlib.h>

static HNode *find_node(const ChainMap *map, int key)
{
    HNode *node = map->buckets[(size_t)key % CHAIN_BUCKETS];
    while (node != NULL && node->key != key) {
        node = node->next;
    }
    return node;
}
void chain_init(ChainMap *map)
{
    for (size_t i = 0; i < CHAIN_BUCKETS; i++) {
        map->buckets[i] = NULL;
    }
    map->count = 0;
}
void chain_clear(ChainMap *map)
{
    for (size_t i = 0; i < CHAIN_BUCKETS; i++) {
        HNode *node = map->buckets[i];
        while (node != NULL) {
            HNode *next = node->next;
            free(node);
            node = next;
        }
    }
    chain_init(map);
}
HStatus chain_put(ChainMap *map, int key, int value)
{
    if (key < 0 || key > H_KEY_MAX) {
        return H_INVALID;
    }
    if (find_node(map, key) != NULL) {
        return H_DUPLICATE;
    }
    if (map->count == H_MAX_ITEMS) {
        return H_FULL;
    }
    HNode *node = malloc(sizeof *node);
    if (node == NULL) {
        return H_MEMORY;
    }
    size_t bucket = (size_t)key % CHAIN_BUCKETS;
    node->key = key;
    node->value = value;
    node->next = map->buckets[bucket];
    map->buckets[bucket] = node;
    map->count++;
    return H_OK;
}
HStatus chain_get(const ChainMap *map, int key, int *out)
{
    if (key < 0 || key > H_KEY_MAX || out == NULL) {
        return H_INVALID;
    }
    const HNode *node = find_node(map, key);
    if (node == NULL) {
        return H_MISSING;
    }
    *out = node->value;
    return H_OK;
}
HStatus chain_set(ChainMap *map, int key, int value)
{
    if (key < 0 || key > H_KEY_MAX) {
        return H_INVALID;
    }
    HNode *node = find_node(map, key);
    if (node == NULL) {
        return H_MISSING;
    }
    node->value = value;
    return H_OK;
}
HStatus chain_erase(ChainMap *map, int key)
{
    if (key < 0 || key > H_KEY_MAX) {
        return H_INVALID;
    }
    size_t bucket = (size_t)key % CHAIN_BUCKETS;
    HNode *previous = NULL, *node = map->buckets[bucket];
    while (node != NULL && node->key != key) {
        previous = node;
        node = node->next;
    }
    if (node == NULL) {
        return H_MISSING;
    }
    if (previous == NULL) {
        map->buckets[bucket] = node->next;
    }
    else {
        previous->next = node->next;
    }
    free(node);
    map->count--;
    return H_OK;
}
