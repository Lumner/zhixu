#include "singly.h"
#include <stdlib.h>

void slist_init(SList *list) {
    list->head.next = NULL;
    list->count = 0;
}

void slist_clear(SList *list)
{
    SNode *node = list->head.next;
    while (node != NULL) {
        SNode *next = node->next;
        free(node);
        node = next;
    }
    slist_init(list);
}

static SNode *before(SList *list, size_t position)
{
    SNode *previous = &list->head;
    for (size_t i = 0; i < position; i++) {
        previous = previous->next;
    }
    return previous;
}

DsStatus slist_get(const SList *list, size_t position, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (position >= list->count) {
        return DS_RANGE;
    }
    const SNode *node = list->head.next;
    for (size_t i = 0; i < position; i++) {
        node = node->next;
    }
    *out = node->value;
    return DS_OK;
}

DsStatus slist_set(SList *list, size_t position, int value)
{
    if (position >= list->count) {
        return DS_RANGE;
    }
    before(list, position)->next->value = value;
    return DS_OK;
}

DsStatus slist_insert(SList *list, size_t position, int value)
{
    if (position > list->count) {
        return DS_RANGE;
    }
    if (list->count == DS_MAX_ITEMS) {
        return DS_FULL;
    }
    SNode *previous = before(list, position);
    SNode *node = malloc(sizeof *node);
    if (node == NULL) {
        return DS_MEMORY;
    }
    node->value = value;
    node->next = previous->next;
    previous->next = node;
    list->count++;
    return DS_OK;
}

DsStatus slist_erase(SList *list, size_t position, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (position >= list->count) {
        return DS_RANGE;
    }
    SNode *previous = before(list, position);
    SNode *node = previous->next;
    int saved = node->value;
    previous->next = node->next;
    free(node);
    list->count--;
    *out = saved;
    return DS_OK;
}
