#include "search.h"
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>

static size_t sorted_cases;
static size_t unsorted_cases;

static void need(int condition, const char *message)
{
    if (!condition) {
        fprintf(stderr, "failed: %s\n", message);
        exit(1);
    }
}

static void check_sorted(const int *values, size_t count, int target)
{
    size_t lower = 0;
    while (lower < count && values[lower] < target) {
        lower++;
    }
    size_t first = count;
    for (size_t i = 0; i < count; i++) {
        if (values[i] == target) {
            first = i;
            break;
        }
    }
    SearchResult l = linear_find(values, count, target);
    SearchResult b = lower_bound_int(values, count, target);
    SearchResult e = binary_find_first(values, count, target);
    need(is_nondecreasing(values, count), "sorted validation");
    need(l.index == first, "linear first position");
    need(b.index == lower, "lower position");
    need(e.index == first, "binary first position");
    need(l.comparisons == (first < count ? first + 1 : count), "linear comparison count");
    size_t limit = 0;
    for (size_t n = count; n > 0; n /= 2) {
        limit++;
    }
    need(b.comparisons <= limit, "lower comparison bound");
    need(e.comparisons == b.comparisons + (b.index < count ? 1 : 0), "binary comparison accounting");
    for (size_t i = 0; i < lower; i++) {
        need(values[i] < target, "left boundary property");
    }
    for (size_t i = lower; i < count; i++) {
        need(values[i] >= target, "right boundary property");
    }
    sorted_cases++;
}

static void enumerate_sorted(int *values, size_t at, size_t count, int minimum)
{
    if (at == count) {
        for (int target = -3; target <= 3; target++) {
            check_sorted(values, count, target);
        }
        return;
    }
    for (int value = minimum; value <= 2; value++) {
        values[at] = value;
        enumerate_sorted(values, at + 1, count, value);
    }
}

static void enumerate_unsorted(int *values, size_t at, size_t count)
{
    if (at == count) {
        int ordered = 1;
        for (size_t i = 1; i < count; i++) {
            if (values[i] < values[i - 1]) {
                ordered = 0;
            }
        }
        need(is_nondecreasing(values, count) == ordered, "order validation of arbitrary array");
        for (int target = -2; target <= 2; target++) {
            size_t first = count;
            for (size_t i = 0; i < count; i++) {
                if (values[i] == target) {
                    first = i;
                    break;
                }
            }
            SearchResult result = linear_find(values, count, target);
            need(result.index == first, "linear arbitrary-array position");
            need(result.comparisons == (first < count ? first + 1 : count), "linear arbitrary-array count");
            unsorted_cases++;
        }
        return;
    }
    for (int value = -1; value <= 1; value++) {
        values[at] = value;
        enumerate_unsorted(values, at + 1, count);
    }
}

int main(void)
{
    int values[7] = {0};
    for (size_t count = 0; count <= 7; count++) {
        enumerate_sorted(values, 0, count, -2);
    }
    need(sorted_cases == 5544, "sorted case count");
    for (size_t count = 0; count <= 6; count++) {
        enumerate_unsorted(values, 0, count);
    }
    need(unsorted_cases == 5465, "arbitrary case count");
    int extremes[] = {INT_MIN, -1, -1, 0, INT_MAX};
    int targets[] = {INT_MIN, INT_MIN + 1, -1, 0, 1, INT_MAX - 1, INT_MAX};
    for (size_t i = 0; i < sizeof targets / sizeof targets[0]; i++) {
        check_sorted(extremes, sizeof extremes / sizeof extremes[0], targets[i]);
    }
    check_sorted(NULL, 0, 0);
    int large[4096];
    for (size_t i = 0; i < 4096; i++) {
        large[i] = (int)(i / 4);
    }
    int large_targets[] = {-1, 0, 1, 511, 1023, 1024};
    for (size_t i = 0; i < sizeof large_targets / sizeof large_targets[0]; i++) {
        check_sorted(large, 4096, large_targets[i]);
    }
    printf("sorted_cases=%zu unsorted_cases=%zu\n", sorted_cases, unsorted_cases);
    return 0;
}
