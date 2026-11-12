#ifndef DSA_PREFIX_STATS_H
#define DSA_PREFIX_STATS_H

#include <stddef.h>

typedef struct {
    long total;
    int maximum;
    size_t first_max;
} PrefixStats;

int prefix_stats(const int *values, size_t count, PrefixStats *out);

#endif
