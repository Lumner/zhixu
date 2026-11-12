#ifndef DSA_STACK_H
#define DSA_STACK_H
#include "ds_status.h"

#define STACK_CAPACITY 16
typedef struct { int data[STACK_CAPACITY]; size_t count; } ArrayStack;
typedef struct StackNode { int value; struct StackNode *next; } StackNode;
typedef struct { StackNode *top; size_t count; } LinkedStack;
void stack_init(ArrayStack *stack);
DsStatus stack_push(ArrayStack *stack, int value);
DsStatus stack_pop(ArrayStack *stack, int *out);
DsStatus stack_peek(const ArrayStack *stack, int *out);
void lstack_init(LinkedStack *stack);
void lstack_clear(LinkedStack *stack);
DsStatus lstack_push(LinkedStack *stack, int value);
DsStatus lstack_pop(LinkedStack *stack, int *out);
DsStatus lstack_peek(const LinkedStack *stack, int *out);
#endif
