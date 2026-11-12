#ifndef DSA_SINGLY_H
#define DSA_SINGLY_H
#include "ds_status.h"

typedef struct SNode { int value; struct SNode *next; } SNode;
typedef struct { SNode head; size_t count; } SList;
void slist_init(SList *list);
void slist_clear(SList *list);
DsStatus slist_get(const SList *list, size_t position, int *out);
DsStatus slist_set(SList *list, size_t position, int value);
DsStatus slist_insert(SList *list, size_t position, int value);
DsStatus slist_erase(SList *list, size_t position, int *out);
#endif
