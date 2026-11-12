#include "prefix_stats.h"
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>

static size_t valid_cases;

static void need(int condition, const char *message)
{
    if (!condition) {
        fprintf(stderr, "failed: %s\n", message);
        exit(1);
    }
}

static void enumerate(int *values, size_t at, size_t count)
{
    if (at == count) {
        long total = 0;
        int maximum = values[0];
        size_t first = 0;
        for (size_t i = 0; i < count; i++) {
            total += values[i];
            if (values[i] > maximum) {
                maximum = values[i];
            }
        }
        while (values[first] != maximum) {
            first++;
        }
        PrefixStats out = {999, 999, 77};
        need(prefix_stats(values, count, &out), "valid statistics status");
        need(out.total == total && out.maximum == maximum, "statistics values");
        need(out.first_max == first, "first maximum position");
        valid_cases++;
        return;
    }
    const int alphabet[] = {0, 1, 1440};
    for (size_t i = 0; i < 3; i++) {
        values[at] = alphabet[i];
        enumerate(values, at + 1, count);
    }
}

static void rejected(const int *values, size_t count)
{
    PrefixStats out = {999, 999, 77};
    need(!prefix_stats(values, count, &out), "invalid statistics status");
    need(out.total == 999 && out.maximum == 999 && out.first_max == 77, "failure preserves fields");
}

int main(void)
{
    int values[6] = {0};
    for (size_t count = 1; count <= 6; count++) {
        enumerate(values, 0, count);
    }
    need(valid_cases == 1092, "statistics case count");
    rejected(NULL, 0);
    rejected(NULL, 1);
    rejected(values, 0);
    need(!prefix_stats(values, 6, NULL), "null output rejected");
    for (size_t at = 0; at < 6; at++) {
        for (size_t i = 0; i < 6; i++) {
            values[i] = 1;
        }
        values[at] = -1;
        rejected(values, 6);
        values[at] = 1441;
        rejected(values, 6);
    }
    int overflow_checked = 0;
    unsigned long candidate = (unsigned long)LONG_MAX / 1440 + 1;
    if (candidate < 2000000UL) {
        size_t count = (size_t)candidate;
        int *many = malloc(count * sizeof *many);
        need(many != NULL, "overflow fixture allocation");
        for (size_t i = 0; i < count; i++) {
            many[i] = 1440;
        }
        PrefixStats out = {0, 0, 0};
        need(prefix_stats(many, count - 1, &out), "largest whole-multiple sum accepted");
        need(out.total == (long)(count - 1) * 1440, "large sum exact");
        rejected(many, count);
        free(many);
        overflow_checked = 1;
    }
    printf("valid_cases=%zu overflow_checked=%d\n", valid_cases, overflow_checked);
    return 0;
}
