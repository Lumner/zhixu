#include "search.h"
#include <stdio.h>

#define CAPACITY 128

int parse_target(const char *text, int *out)
{
    int value = 0;
    if (text[0] == '\0') {
        return 0;
    }
    for (size_t i = 0; text[i] != '\0'; i++) {
        if (text[i] < '0' || text[i] > '9') {
            return 0;
        }
        int digit = text[i] - '0';
        if (value > 9999 / 10 || (value == 9999 / 10 && digit > 9999 % 10)) {
            return 0;
        }
        value = value * 10 + digit;
    }
    *out = value;
    return 1;
}

int read_number(int limit)
{
    int ch = getchar();
    int value = 0;
    int has_digit = 0;
    int valid = 1;
    while (ch != '\n' && ch != EOF) {
        if (ch < '0' || ch > '9') {
            valid = 0;
        } else {
            int digit = ch - '0';
            has_digit = 1;
            if (value > limit / 10 || (value == limit / 10 && digit > limit % 10)) {
                valid = 0;
            }
            if (valid) {
                value = value * 10 + digit;
            }
        }
        ch = getchar();
    }
    return valid && has_digit ? value : -1;
}

int main(int argc, char *argv[])
{
    int target = 0;
    if (argc != 2 || !parse_target(argv[1], &target)) {
        fputs("usage: search_lab target (0..9999)\n", stderr);
        return 1;
    }
    int entered_count = read_number(CAPACITY);
    if (entered_count < 0) {
        fputs("invalid count\n", stderr);
        return 1;
    }
    size_t count = (size_t)entered_count;
    int values[CAPACITY];
    for (size_t i = 0; i < count; i++) {
        int value = read_number(9999);
        if (value < 0) {
            fputs("invalid value\n", stderr);
            return 1;
        }
        values[i] = value;
    }
    if (!is_nondecreasing(values, count)) {
        fputs("array is not sorted\n", stderr);
        return 1;
    }
    SearchResult lower = lower_bound_int(values, count, target);
    SearchResult linear = linear_find(values, count, target);
    SearchResult binary = binary_find_first(values, count, target);
    printf("count=%zu target=%d\nlower=%zu\n", count, target, lower.index);
    printf("linear=%zu comparisons=%zu found=%d\n",
           linear.index, linear.comparisons, linear.index < count);
    printf("binary=%zu comparisons=%zu found=%d\n",
           binary.index, binary.comparisons, binary.index < count);
    return 0;
}
