#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    int *values = malloc(2 * sizeof *values);
    if (values == NULL) {
        fputs("allocation failed\n", stderr);
        return 1;
    }
    values[0] = 10;
    values[1] = 20;

    size_t new_count = 4;
    if (new_count > SIZE_MAX / sizeof *values) {
        free(values);
        return 1;
    }
    int *grown = realloc(values, new_count * sizeof *values);
    if (grown == NULL) {
        fputs("growth failed\n", stderr);
        free(values);
        return 1;
    }
    values = grown;
    values[2] = 30;
    values[3] = 40;
    printf("sum=%d\n", values[0] + values[1] + values[2] + values[3]);
    free(values);
    values = NULL;

    int *zeros = calloc(3, sizeof *zeros);
    if (zeros == NULL) {
        fputs("zero allocation failed\n", stderr);
        return 1;
    }
    printf("zeros=%d,%d,%d\n", zeros[0], zeros[1], zeros[2]);
    free(zeros);
    return 0;
}
