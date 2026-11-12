#include "queue.h"
#include <stdlib.h>

DsStatus queue_init(Queue *queue, size_t capacity)
{
    if (capacity == 0 || capacity > QUEUE_MAX_CAPACITY) {
        return DS_INVALID;
    }
    queue->capacity = capacity;
    queue->head = queue->count = 0;
    return DS_OK;
}
DsStatus queue_push(Queue *queue, int value)
{
    if (queue->count == queue->capacity) {
        return DS_FULL;
    }
    size_t tail = (queue->head + queue->count) % queue->capacity;
    queue->data[tail] = value;
    queue->count++;
    return DS_OK;
}
DsStatus queue_pop(Queue *queue, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (queue->count == 0) {
        return DS_EMPTY;
    }
    *out = queue->data[queue->head];
    queue->head = (queue->head + 1) % queue->capacity;
    queue->count--;
    return DS_OK;
}
DsStatus queue_peek(const Queue *queue, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (queue->count == 0) {
        return DS_EMPTY;
    }
    *out = queue->data[queue->head];
    return DS_OK;
}
void lqueue_init(LinkedQueue *queue) {
    queue->head = queue->tail = NULL;
    queue->count = 0;
}
void lqueue_clear(LinkedQueue *queue)
{
    QNode *node = queue->head;
    while (node != NULL) {
        QNode *next = node->next;
        free(node);
        node = next;
    }
    lqueue_init(queue);
}
DsStatus lqueue_push(LinkedQueue *queue, int value)
{
    if (queue->count == DS_MAX_ITEMS) {
        return DS_FULL;
    }
    QNode *node = malloc(sizeof *node);
    if (node == NULL) {
        return DS_MEMORY;
    }
    node->value = value;
    node->next = NULL;
    if (queue->tail == NULL) {
        queue->head = node;
    }
    else {
        queue->tail->next = node;
    }
    queue->tail = node;
    queue->count++;
    return DS_OK;
}
DsStatus lqueue_pop(LinkedQueue *queue, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (queue->count == 0) {
        return DS_EMPTY;
    }
    QNode *node = queue->head;
    int saved = node->value;
    queue->head = node->next;
    queue->count--;
    if (queue->head == NULL) {
        queue->tail = NULL;
    }
    free(node);
    *out = saved;
    return DS_OK;
}
DsStatus lqueue_peek(const LinkedQueue *queue, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (queue->count == 0) {
        return DS_EMPTY;
    }
    *out = queue->head->value;
    return DS_OK;
}
