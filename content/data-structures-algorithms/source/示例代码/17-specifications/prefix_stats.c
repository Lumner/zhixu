#include "prefix_stats.h"
#include <limits.h>

int prefix_stats(const int *values, size_t count, PrefixStats *out)
{
    if (out == NULL || count == 0 || values == NULL) {
        return 0;
    }
    if (values[0] < 0 || values[0] > 1440) {
        return 0;
    }
    PrefixStats result = {values[0], values[0], 0};
    for (size_t i = 1; i < count; i++) {
        int value = values[i];
        if (value < 0 || value > 1440 || result.total > LONG_MAX - value) {
            return 0;
        }
        result.total += value;
        if (value > result.maximum) {
            result.maximum = value;
            result.first_max = i;
        }
    }
    *out = result;
    return 1;
}
