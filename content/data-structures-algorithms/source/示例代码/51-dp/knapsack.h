#ifndef DSA_KNAPSACK_H
#define DSA_KNAPSACK_H
#include "design.h"
typedef struct { unsigned cost, value; } PackItem;
typedef struct { unsigned value, cost, mask; } PackResult;
DStatus pack01_table(const PackItem *items, size_t n, unsigned budget, PackResult *out);
DStatus pack01_rolling(const PackItem *items, size_t n, unsigned budget, unsigned *out);
#endif
