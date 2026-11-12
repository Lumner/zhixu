#include "brackets.h"
#include "stack.h"
#include <string.h>

BracketStatus brackets_check(const char *text, size_t *error_position)
{
    if (text == NULL || error_position == NULL) {
        return B_INVALID;
    }
    size_t length = strlen(text);
    if (length > 256) {
        *error_position = 256;
        return B_LENGTH;
    }
    ArrayStack pending;
    stack_init(&pending);
    for (size_t i = 0; i < length; i++) {
        char ch = text[i];
        if (ch == '(' || ch == '[' || ch == '{') {
            if (stack_push(&pending, (int)i) != DS_OK) {
                *error_position = i;
                return B_DEPTH;
            }
        } else if (ch == ')' || ch == ']' || ch == '}') {
            int opening = 0;
            if (stack_peek(&pending, &opening) != DS_OK ||
                !((text[opening] == '(' && ch == ')') ||
                  (text[opening] == '[' && ch == ']') ||
                  (text[opening] == '{' && ch == '}'))) {
                *error_position = i;
                return B_MISMATCH;
            }
            if (stack_pop(&pending, &opening) != DS_OK) {
                return B_INVALID;
            }
        }
    }
    if (pending.count > 0) {
        int earliest = 0;
        while (stack_pop(&pending, &earliest) == DS_OK) {
        }
        *error_position = (size_t)earliest;
        return B_UNCLOSED;
    }
    return B_OK;
}

const char *brackets_status_name(BracketStatus status)
{
    switch (status) {
    case B_OK: return "ok";
    case B_MISMATCH: return "mismatch";
    case B_UNCLOSED: return "unclosed";
    case B_DEPTH: return "depth";
    case B_LENGTH: return "length";
    default: return "invalid";
    }
}
