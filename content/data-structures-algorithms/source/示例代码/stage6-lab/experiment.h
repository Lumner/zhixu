#ifndef DSA_SORT_EXPERIMENT_H
#define DSA_SORT_EXPERIMENT_H
#include "sort.h"
#define ALGORITHM_COUNT 9
#define DATASET_COUNT 5
const char *algorithm_name(size_t algorithm);
const char *dataset_name(size_t dataset);
SortStatus experiment_run(size_t algorithm, SItem *a, size_t n, SortStats *out);
void experiment_data(size_t dataset, SItem *a, size_t n);
int experiment_check(const SItem *before, const SItem *after, size_t n, int require_stable);
int algorithm_is_stable(size_t algorithm);
#endif
