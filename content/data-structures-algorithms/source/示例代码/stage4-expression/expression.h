#ifndef DSA_EXPRESSION_H
#define DSA_EXPRESSION_H
#include <stddef.h>
typedef enum { E_OK, E_TOKEN, E_CAPACITY, E_ARITY, E_DIVZERO, E_RANGE, E_LENGTH, E_INVALID } ExprStatus;
ExprStatus expression_evaluate(const char *text, int *out, size_t *error_token);
const char *expression_status_name(ExprStatus status);
#endif
