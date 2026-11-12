#ifndef DSA_QUEUE_H
#define DSA_QUEUE_H
#include "ds_status.h"

#define QUEUE_MAX_CAPACITY 16
typedef struct { int data[QUEUE_MAX_CAPACITY]; size_t capacity; size_t head; size_t count; } Queue;
typedef struct QNode { int value; struct QNode *next; } QNode;
typedef struct { QNode *head; QNode *tail; size_t count; } LinkedQueue;
DsStatus queue_init(Queue *queue, size_t capacity);
DsStatus queue_push(Queue *queue, int value);
DsStatus queue_pop(Queue *queue, int *out);
DsStatus queue_peek(const Queue *queue, int *out);
void lqueue_init(LinkedQueue *queue);
void lqueue_clear(LinkedQueue *queue);
DsStatus lqueue_push(LinkedQueue *queue, int value);
DsStatus lqueue_pop(LinkedQueue *queue, int *out);
DsStatus lqueue_peek(const LinkedQueue *queue, int *out);
#endif
