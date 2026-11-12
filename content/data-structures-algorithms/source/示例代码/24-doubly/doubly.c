#include "doubly.h"
#include <stdlib.h>

void dlist_init(DList *list)
{
    list->root.next = list->root.previous = &list->root;
    list->count = 0;
}

void dlist_clear(DList *list)
{
    DNode *node = list->root.next;
    while (node != &list->root) {
        DNode *next = node->next;
        free(node);
        node = next;
    }
    dlist_init(list);
}

static DNode *node_at(const DList *list, size_t position)
{
    DNode *node;
    if (position < list->count / 2) {
        node = list->root.next;
        for (size_t i = 0; i < position; i++) {
            node = node->next;
        }
    } else {
        node = list->root.previous;
        for (size_t i = list->count - 1; i > position; i--) {
            node = node->previous;
        }
    }
    return node;
}

DsStatus dlist_get(const DList *list, size_t position, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (position >= list->count) {
        return DS_RANGE;
    }
    *out = node_at(list, position)->value;
    return DS_OK;
}

DsStatus dlist_set(DList *list, size_t position, int value)
{
    if (position >= list->count) {
        return DS_RANGE;
    }
    node_at(list, position)->value = value;
    return DS_OK;
}

DsStatus dlist_insert(DList *list, size_t position, int value)
{
    if (position > list->count) {
        return DS_RANGE;
    }
    if (list->count == DS_MAX_ITEMS) {
        return DS_FULL;
    }
    DNode *next = position == list->count ? &list->root : node_at(list, position);
    DNode *node = malloc(sizeof *node);
    if (node == NULL) {
        return DS_MEMORY;
    }
    node->value = value;
    node->previous = next->previous;
    node->next = next;
    next->previous->next = node;
    next->previous = node;
    list->count++;
    return DS_OK;
}

DsStatus dlist_erase(DList *list, size_t position, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (position >= list->count) {
        return DS_RANGE;
    }
    DNode *node = node_at(list, position);
    int saved = node->value;
    node->previous->next = node->next;
    node->next->previous = node->previous;
    free(node);
    list->count--;
    *out = saved;
    return DS_OK;
}
