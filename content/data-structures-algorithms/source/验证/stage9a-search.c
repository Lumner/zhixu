#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "interval.h"
#include "subset.h"
#define REQUIRE(test) do { if (!(test)) { fprintf(stderr,"search oracle failed at %d\n",__LINE__); exit(1); } } while (0)
static unsigned bits(unsigned mask)
{
    unsigned count = 0;
    while (mask != 0) { count += mask & 1u; mask >>= 1; }
    return count;
}
static void intervals(const Activity *items, size_t n)
{
    Activity before[D_ITEMS] = {{0}};
    if (n != 0) { memcpy(before, items, n * sizeof(*items)); }
    unsigned optimum = 0;
    for (unsigned mask = 0; mask < (1u << n); mask++) {
        int valid = 1;
        for (size_t i = 0; i < n; i++) {
            for (size_t j = i + 1; j < n; j++) {
                if ((mask & (1u << i)) && (mask & (1u << j)) &&
                    items[i].start < items[j].end && items[j].start < items[i].end) { valid = 0; }
            }
        }
        if (valid && bits(mask) > optimum) { optimum = bits(mask); }
    }
    Schedule result;
    REQUIRE(activity_select(items, n, &result) == D_OK);
    REQUIRE(result.count == optimum);
    unsigned used = 0, end = 0;
    for (size_t k = 0; k < result.count; k++) {
        size_t i = 0;
        while (i < n && items[i].id != result.ids[k]) { i++; }
        REQUIRE(i < n && !(used & (1u << i)));
        REQUIRE(k == 0 || end <= items[i].start);
        used |= 1u << i; end = items[i].end;
    }
    REQUIRE(n == 0 || memcmp(before, items, n * sizeof(*items)) == 0);
}
static void subsets(const unsigned *values, size_t n, unsigned target)
{
    unsigned before[D_ITEMS] = {0};
    if (n != 0) { memcpy(before, values, n * sizeof(*values)); }
    unsigned char expected[D_SUB_SOLUTIONS] = {0}, seen[D_SUB_SOLUTIONS] = {0};
    size_t count = 0;
    for (unsigned mask = 0; mask < (1u << n); mask++) {
        unsigned total = 0;
        for (size_t i = 0; i < n; i++) { if (mask & (1u << i)) { total += values[i]; } }
        if (total == target) { expected[mask] = 1; count++; }
    }
    SubsetResult plain, pruned;
    REQUIRE(subset_sums(values, n, target, 0, &plain) == D_OK);
    REQUIRE(subset_sums(values, n, target, 1, &pruned) == D_OK);
    REQUIRE(plain.count == count && pruned.count == count);
    REQUIRE(plain.nodes == (1ul << (n + 1)) - 1 && plain.pruned == 0);
    REQUIRE(pruned.nodes <= plain.nodes && pruned.pruned <= pruned.nodes);
    for (size_t i = 0; i < plain.count; i++) {
        unsigned mask = plain.masks[i];
        REQUIRE(mask < (1u << n) && expected[mask] && !seen[mask]);
        REQUIRE(mask == pruned.masks[i]); seen[mask] = 1;
    }
    for (unsigned m = 0; m < (1u << n); m++) { REQUIRE(seen[m] == expected[m]); }
    REQUIRE(n == 0 || memcmp(before, values, n * sizeof(*values)) == 0);
}
int main(void)
{
    Activity types[10], items[D_ITEMS] = {{0}};
    size_t t = 0;
    for (unsigned start = 0; start < 4; start++) {
        for (unsigned end = start + 1; end <= 4; end++) { types[t++] = (Activity){0,start,end}; }
    }
    unsigned long interval_cases = 0, subset_cases = 0;
    unsigned combinations = 1;
    for (size_t n = 0; n <= 5; n++) {
        for (unsigned code = 0; code < combinations; code++) {
            unsigned rest = code;
            for (size_t i = 0; i < n; i++) {
                items[i] = types[rest % 10]; items[i].id = (unsigned)(i + 1); rest /= 10;
            }
            intervals(items, n); interval_cases++;
        }
        combinations *= 10;
    }
    for (size_t i = 0; i < D_ITEMS; i++) { items[i] = (Activity){(unsigned)i,(unsigned)i,(unsigned)i+1}; }
    intervals(items, D_ITEMS); intervals(NULL, 0);
    Schedule output, old;
    memset(&output, 0x5a, sizeof(output)); memcpy(&old, &output, sizeof(old));
    items[1].id = items[0].id;
    REQUIRE(activity_select(items, D_ITEMS, &output) == D_INVALID);
    REQUIRE(memcmp(&output, &old, sizeof(output)) == 0);
    items[1].id = 1; items[1].start = items[1].end;
    REQUIRE(activity_select(items, D_ITEMS, &output) == D_INVALID);
    items[1].start = 1; items[1].end = 61;
    REQUIRE(activity_select(items, D_ITEMS, &output) == D_RANGE);
    REQUIRE(activity_select(items, D_ITEMS + 1, &output) == D_RANGE);
    REQUIRE(activity_select(NULL, 1, &output) == D_INVALID);
    REQUIRE(activity_select(NULL, 0, NULL) == D_INVALID);
    REQUIRE(memcmp(&output, &old, sizeof(output)) == 0);
    unsigned values[D_ITEMS] = {0}; combinations = 1;
    for (size_t n = 0; n <= 6; n++) {
        for (unsigned code = 0; code < combinations; code++) {
            unsigned rest = code;
            for (size_t i = 0; i < n; i++) { values[i] = rest % 4; rest /= 4; }
            for (unsigned target = 0; target <= 18; target++) { subsets(values, n, target); subset_cases++; }
        }
        combinations *= 4;
    }
    memset(values, 0, sizeof(values)); subsets(values, D_ITEMS, 0);
    for (size_t i = 0; i < D_ITEMS; i++) { values[i] = D_SUB_VALUE; }
    subsets(values, D_ITEMS, D_SUB_TARGET); subsets(values, D_ITEMS, 159);
    SubsetResult result, saved;
    memset(&result, 0x5a, sizeof(result)); memcpy(&saved, &result, sizeof(saved));
    REQUIRE(subset_sums(values, D_ITEMS + 1, 0, 1, &result) == D_RANGE);
    REQUIRE(subset_sums(values, D_ITEMS, D_SUB_TARGET + 1, 1, &result) == D_RANGE);
    values[0] = D_SUB_VALUE + 1;
    REQUIRE(subset_sums(values, D_ITEMS, 0, 1, &result) == D_RANGE);
    REQUIRE(subset_sums(NULL, 1, 0, 1, &result) == D_INVALID);
    REQUIRE(subset_sums(NULL, 0, 0, 2, &result) == D_INVALID);
    REQUIRE(subset_sums(NULL, 0, 0, 1, NULL) == D_INVALID);
    REQUIRE(memcmp(&result, &saved, sizeof(result)) == 0);
    printf("interval_cases=%lu subset_cases=%lu boundaries=1\n", interval_cases, subset_cases);
    return 0;
}
