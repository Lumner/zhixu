#include "stack.h"
#include <stdlib.h>

void stack_init(ArrayStack *stack) {
    stack->count = 0;
}
DsStatus stack_push(ArrayStack *stack, int value)
{
    if (stack->count == STACK_CAPACITY) {
        return DS_FULL;
    }
    stack->data[stack->count] = value;
    stack->count++;
    return DS_OK;
}
DsStatus stack_pop(ArrayStack *stack, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (stack->count == 0) {
        return DS_EMPTY;
    }
    *out = stack->data[stack->count - 1];
    stack->count--;
    return DS_OK;
}
DsStatus stack_peek(const ArrayStack *stack, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (stack->count == 0) {
        return DS_EMPTY;
    }
    *out = stack->data[stack->count - 1];
    return DS_OK;
}
void lstack_init(LinkedStack *stack) {
    stack->top = NULL;
    stack->count = 0;
}
void lstack_clear(LinkedStack *stack)
{
    StackNode *node = stack->top;
    while (node != NULL) {
        StackNode *next = node->next;
        free(node);
        node = next;
    }
    lstack_init(stack);
}
DsStatus lstack_push(LinkedStack *stack, int value)
{
    if (stack->count == DS_MAX_ITEMS) {
        return DS_FULL;
    }
    StackNode *node = malloc(sizeof *node);
    if (node == NULL) {
        return DS_MEMORY;
    }
    node->value = value;
    node->next = stack->top;
    stack->top = node;
    stack->count++;
    return DS_OK;
}
DsStatus lstack_pop(LinkedStack *stack, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (stack->count == 0) {
        return DS_EMPTY;
    }
    StackNode *node = stack->top;
    int saved = node->value;
    stack->top = node->next;
    free(node);
    stack->count--;
    *out = saved;
    return DS_OK;
}
DsStatus lstack_peek(const LinkedStack *stack, int *out)
{
    if (out == NULL) {
        return DS_INVALID;
    }
    if (stack->count == 0) {
        return DS_EMPTY;
    }
    *out = stack->top->value;
    return DS_OK;
}
