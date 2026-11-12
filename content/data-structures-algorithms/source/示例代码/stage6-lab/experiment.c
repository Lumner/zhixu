#include "experiment.h"
#include <string.h>
const char *algorithm_name(size_t algorithm)
{
    static const char *names[] = {"selection", "bubble", "insertion", "shell", "merge", "quick", "counting", "bucket", "radix"};
    return algorithm < ALGORITHM_COUNT ? names[algorithm] : "invalid";
}
const char *dataset_name(size_t dataset)
{
    static const char *names[] = {"sorted", "reverse", "equal", "nearly", "mixed"};
    return dataset < DATASET_COUNT ? names[dataset] : "invalid";
}
int algorithm_is_stable(size_t algorithm)
{
    return algorithm == 1 || algorithm == 2 || algorithm == 4 || algorithm >= 6;
}
SortStatus experiment_run(size_t algorithm, SItem *a, size_t n, SortStats *out)
{
    switch (algorithm) {
    case 0: return selection_sort(a, n, out);
    case 1: return bubble_sort(a, n, out);
    case 2: return insertion_sort(a, n, out);
    case 3: return shell_sort(a, n, out);
    case 4: return merge_sort(a, n, out);
    case 5: return quick_sort(a, n, out);
    case 6: return counting_sort(a, n, out);
    case 7: return bucket_sort(a, n, out);
    case 8: return radix_sort(a, n, out);
    default: return S_INVALID;
    }
}
void experiment_data(size_t dataset, SItem *a, size_t n)
{
    for (size_t i = 0; i < n; i++) {
        int key = (int)i;
        if (dataset == 1) { key = (int)(n - 1 - i); }
        else if (dataset == 2) { key = 5; }
        else if (dataset == 4) { key = (int)((i * 17) % 23) - 11; }
        a[i].key = key; a[i].tag = (int)i;
    }
    if (dataset == 3 && n > 1) {
        SItem saved = a[0]; a[0] = a[1]; a[1] = saved;
    }
}
int experiment_check(const SItem *before, const SItem *after, size_t n, int require_stable)
{
    if (n > SORT_MAX) { return 0; }
    int seen[SORT_MAX] = {0};
    size_t previous_position = 0;
    for (size_t i = 0; i < n; i++) {
        if (i > 0 && after[i - 1].key > after[i].key) { return 0; }
        size_t position = 0;
        while (position < n && (before[position].key != after[i].key || before[position].tag != after[i].tag || seen[position])) { position++; }
        if (position == n) { return 0; }
        seen[position] = 1;
        if (require_stable && i > 0 && after[i - 1].key == after[i].key && previous_position > position) { return 0; }
        previous_position = position;
    }
    return 1;
}
