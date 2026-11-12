#ifndef DSA_MIN_HEAP_H
#define DSA_MIN_HEAP_H
#include "tree_status.h"
typedef struct { int priority; int id; } Job;
typedef struct { Job data[TREE_LIMIT]; size_t count; } MinHeap;
void heap_init(MinHeap *heap);
TStatus heap_build(MinHeap *heap, const Job *values, size_t n);
TStatus heap_push(MinHeap *heap, Job job);
TStatus heap_peek(const MinHeap *heap, Job *out);
TStatus heap_pop(MinHeap *heap, Job *out);
#endif
