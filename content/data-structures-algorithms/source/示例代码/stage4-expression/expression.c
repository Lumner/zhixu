#include "expression.h"
#include "stack.h"
#include "queue.h"
#include <string.h>

ExprStatus expression_evaluate(const char *text, int *out, size_t *error_token)
{
    if (text == NULL || out == NULL || error_token == NULL) {
        return E_INVALID;
    }
    if (strlen(text) > 127) {
        *error_token = 0;
        return E_LENGTH;
    }
    Queue tokens;
    if (queue_init(&tokens, QUEUE_MAX_CAPACITY) != DS_OK) {
        return E_INVALID;
    }
    size_t number = 0;
    for (size_t i = 0; text[i] != '\0'; i++) {
        char ch = text[i];
        if (ch == ' ') {
            continue;
        }
        if (!((ch >= '0' && ch <= '9') || ch == '+' || ch == '-' || ch == '*' || ch == '/') ||
            (text[i + 1] != '\0' && text[i + 1] != ' ')) {
            *error_token = number;
            return E_TOKEN;
        }
        if (queue_push(&tokens, ch) != DS_OK) {
            *error_token = number;
            return E_CAPACITY;
        }
        number++;
    }
    ArrayStack values;
    stack_init(&values);
    size_t index = 0;
    int token = 0;
    while (queue_pop(&tokens, &token) == DS_OK) {
        if (token >= '0' && token <= '9') {
            if (stack_push(&values, token - '0') != DS_OK) {
                *error_token = index;
                return E_CAPACITY;
            }
        } else {
            int right = 0, left = 0;
            if (stack_pop(&values, &right) != DS_OK || stack_pop(&values, &left) != DS_OK) {
                *error_token = index;
                return E_ARITY;
            }
            long result = 0;
            switch (token) {
            case '+': result = (long)left + right; break;
            case '-': result = (long)left - right; break;
            case '*': result = (long)left * right; break;
            case '/':
                if (right == 0) {
                    *error_token = index;
                    return E_DIVZERO;
                }
                result = (long)left / right;
                break;
            default: return E_INVALID;
            }
            if (result < -9999 || result > 9999) {
                *error_token = index;
                return E_RANGE;
            }
            if (stack_push(&values, (int)result) != DS_OK) {
                *error_token = index;
                return E_CAPACITY;
            }
        }
        index++;
    }
    int final = 0;
    if (stack_pop(&values, &final) != DS_OK || values.count != 0) {
        *error_token = number;
        return E_ARITY;
    }
    *out = final;
    return E_OK;
}

const char *expression_status_name(ExprStatus status)
{
    switch (status) {
    case E_OK: return "ok";
    case E_TOKEN: return "token";
    case E_CAPACITY: return "capacity";
    case E_ARITY: return "arity";
    case E_DIVZERO: return "division-by-zero";
    case E_RANGE: return "range";
    case E_LENGTH: return "length";
    default: return "invalid";
    }
}
