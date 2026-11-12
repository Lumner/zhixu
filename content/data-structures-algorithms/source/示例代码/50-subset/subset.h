#ifndef DSA_SUBSET_H
#define DSA_SUBSET_H
#include "design.h"
typedef struct {
    unsigned masks[D_SUB_SOLUTIONS];
    size_t count;
    unsigned long nodes, pruned;
} SubsetResult;
DStatus subset_sums(const unsigned *values, size_t n, unsigned target,
                    int pruning, SubsetResult *out);
#endif
