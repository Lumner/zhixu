#include "heap.h"
static int compare(Job a, Job b)
{
    if (a.priority != b.priority) { return a.priority < b.priority ? -1 : 1; }
    if (a.id != b.id) { return a.id < b.id ? -1 : 1; }
    return 0;
}
static void swap(Job *a, Job *b) { Job saved = *a; *a = *b; *b = saved; }
static void down(MinHeap *heap, size_t root)
{
    while (root < heap->count / 2) {
        size_t child = root * 2 + 1;
        if (child + 1 < heap->count && compare(heap->data[child + 1], heap->data[child]) < 0) { child++; }
        if (compare(heap->data[root], heap->data[child]) <= 0) { break; }
        swap(&heap->data[root], &heap->data[child]); root = child;
    }
}
void heap_init(MinHeap *heap) { *heap = (MinHeap){0}; }
TStatus heap_build(MinHeap *heap, const Job *values, size_t n)
{
    if (n != 0 && values == NULL) { return T_INVALID; }
    if (n > TREE_LIMIT) { return T_FULL; }
    MinHeap next = {0}; next.count = n;
    for (size_t i = 0; i < n; i++) { next.data[i] = values[i]; }
    for (size_t i = n / 2; i > 0; i--) { down(&next, i - 1); }
    *heap = next; return T_OK;
}
TStatus heap_push(MinHeap *heap, Job job)
{
    if (heap->count == TREE_LIMIT) { return T_FULL; }
    size_t child = heap->count++; heap->data[child] = job;
    while (child > 0) {
        size_t parent = (child - 1) / 2;
        if (compare(heap->data[parent], heap->data[child]) <= 0) { break; }
        swap(&heap->data[parent], &heap->data[child]); child = parent;
    }
    return T_OK;
}
TStatus heap_peek(const MinHeap *heap, Job *out)
{
    if (out == NULL) { return T_INVALID; }
    if (heap->count == 0) { return T_EMPTY; }
    *out = heap->data[0]; return T_OK;
}
TStatus heap_pop(MinHeap *heap, Job *out)
{
    if (out == NULL) { return T_INVALID; }
    if (heap->count == 0) { return T_EMPTY; }
    Job saved = heap->data[0]; heap->count--;
    if (heap->count != 0) { heap->data[0] = heap->data[heap->count]; down(heap, 0); }
    *out = saved; return T_OK;
}
