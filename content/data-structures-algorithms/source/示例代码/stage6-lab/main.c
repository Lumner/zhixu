#include "experiment.h"
#include <stdio.h>
#include <string.h>
int main(int argc, char **argv)
{
    if (argc != 3) { fputs("usage: sort-lab algorithm|all dataset\n", stderr); return 1; }
    size_t first = 0, last = ALGORITHM_COUNT, dataset = 0;
    if (strcmp(argv[1], "all") != 0) {
        while (first < ALGORITHM_COUNT && strcmp(argv[1], algorithm_name(first)) != 0) { first++; }
        if (first == ALGORITHM_COUNT) { fputs("unknown algorithm\n", stderr); return 1; }
        last = first + 1;
    }
    while (dataset < DATASET_COUNT && strcmp(argv[2], dataset_name(dataset)) != 0) { dataset++; }
    if (dataset == DATASET_COUNT) { fputs("unknown dataset\n", stderr); return 1; }
    SItem original[32], a[32];
    experiment_data(dataset, original, 32);
    for (size_t k = first; k < last; k++) {
        memcpy(a, original, sizeof a); SortStats stats;
        if (experiment_run(k, a, 32, &stats) != S_OK || !experiment_check(original, a, 32, algorithm_is_stable(k))) {
            fputs("experiment failed\n", stderr); return 1;
        }
        printf("%s %s n=32 comparisons=%zu writes=%zu verified=1\n", algorithm_name(k), dataset_name(dataset), stats.comparisons, stats.writes);
    }
    return 0;
}
