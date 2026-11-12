#include <stdio.h>

int parse_size(const char *text, size_t *out)
{
    size_t value = 0;
    if (text[0] == '\0') {
        return 0;
    }
    for (size_t i = 0; text[i] != '\0'; i++) {
        if (text[i] < '0' || text[i] > '9') {
            return 0;
        }
        size_t digit = (size_t)(text[i] - '0');
        if (value > 128 / 10 || (value == 128 / 10 && digit > 128 % 10)) {
            return 0;
        }
        value = value * 10 + digit;
    }
    *out = value;
    return 1;
}

int main(int argc, char *argv[])
{
    size_t n = 0;
    if (argc != 2 || !parse_size(argv[1], &n)) {
        fputs("usage: growth n (0..128)\n", stderr);
        return 1;
    }
    size_t linear = 0;
    size_t square = 0;
    size_t pairs = 0;
    size_t halves = 0;
    for (size_t i = 0; i < n; i++) {
        linear++;
    }
    for (size_t i = 0; i < n; i++) {
        for (size_t j = 0; j < n; j++) {
            square++;
        }
    }
    for (size_t i = 0; i < n; i++) {
        for (size_t j = i + 1; j < n; j++) {
            pairs++;
        }
    }
    for (size_t remaining = n; remaining > 1; remaining /= 2) {
        halves++;
    }
    printf("n=%zu linear=%zu square=%zu pairs=%zu halves=%zu\n",
           n, linear, square, pairs, halves);
    return 0;
}
