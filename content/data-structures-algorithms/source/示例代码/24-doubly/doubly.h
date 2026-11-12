#ifndef DSA_DOUBLY_H
#define DSA_DOUBLY_H
#include "ds_status.h"

typedef struct DNode { int value; struct DNode *previous; struct DNode *next; } DNode;
typedef struct { DNode root; size_t count; } DList;
void dlist_init(DList *list);
void dlist_clear(DList *list);
DsStatus dlist_get(const DList *list, size_t position, int *out);
DsStatus dlist_set(DList *list, size_t position, int value);
DsStatus dlist_insert(DList *list, size_t position, int value);
DsStatus dlist_erase(DList *list, size_t position, int *out);
#endif
