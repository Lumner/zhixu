#ifndef DSA_BRACKETS_H
#define DSA_BRACKETS_H
#include <stddef.h>
typedef enum { B_OK, B_MISMATCH, B_UNCLOSED, B_DEPTH, B_LENGTH, B_INVALID } BracketStatus;
BracketStatus brackets_check(const char *text, size_t *error_position);
const char *brackets_status_name(BracketStatus status);
#endif
