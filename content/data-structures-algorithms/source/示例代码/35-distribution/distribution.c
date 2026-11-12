#include "sort_internal.h"
#include <stdlib.h>
#define KEY_RANGE (SORT_HIGH - SORT_LOW + 1)
#define BUCKET_COUNT 10
#define BUCKET_WIDTH 200
static void positions(const size_t *counts, size_t *next, size_t k)
{
    size_t total = 0;
    for (size_t i = 0; i < k; i++) { next[i] = total; total += counts[i]; }
}
static SortStatus prepare(const SItem *a, size_t n, const SortStats *out)
{
    SortStatus status = sort_validate(a, n, out);
    return status == S_OK ? sort_domain(a, n) : status;
}
SortStatus counting_sort(SItem *a, size_t n, SortStats *out)
{
    SortStatus status = prepare(a, n, out);
    if (status != S_OK) { return status; }
    SortStats stats = {0, 0};
    if (n > 1) {
        SItem *work = malloc(n * sizeof *work);
        if (work == NULL) { return S_MEMORY; }
        size_t counts[KEY_RANGE] = {0}, next[KEY_RANGE];
        for (size_t i = 0; i < n; i++) { counts[a[i].key - SORT_LOW]++; }
        positions(counts, next, KEY_RANGE);
        for (size_t i = 0; i < n; i++) {
            size_t key = (size_t)(a[i].key - SORT_LOW);
            sort_write(work, next[key]++, a[i], &stats);
        }
        for (size_t i = 0; i < n; i++) { sort_write(a, i, work[i], &stats); }
        free(work);
    }
    *out = stats;
    return S_OK;
}
SortStatus bucket_sort(SItem *a, size_t n, SortStats *out)
{
    SortStatus status = prepare(a, n, out);
    if (status != S_OK) { return status; }
    SortStats stats = {0, 0};
    if (n > 1) {
        SItem *work = malloc(n * sizeof *work);
        if (work == NULL) { return S_MEMORY; }
        size_t counts[BUCKET_COUNT] = {0}, starts[BUCKET_COUNT], next[BUCKET_COUNT];
        for (size_t i = 0; i < n; i++) { counts[(a[i].key - SORT_LOW) / BUCKET_WIDTH]++; }
        positions(counts, starts, BUCKET_COUNT);
        for (size_t b = 0; b < BUCKET_COUNT; b++) { next[b] = starts[b]; }
        for (size_t i = 0; i < n; i++) {
            size_t b = (size_t)((a[i].key - SORT_LOW) / BUCKET_WIDTH);
            sort_write(work, next[b]++, a[i], &stats);
        }
        for (size_t b = 0; b < BUCKET_COUNT; b++) {
            size_t lo = starts[b], hi = lo + counts[b];
            for (size_t i = lo + 1; i < hi; i++) {
                SItem saved = work[i]; size_t j = i;
                while (j > lo && sort_compare(work[j - 1].key, saved.key, &stats) > 0) {
                    sort_write(work, j, work[j - 1], &stats); j--;
                }
                sort_write(work, j, saved, &stats);
            }
        }
        for (size_t i = 0; i < n; i++) { sort_write(a, i, work[i], &stats); }
        free(work);
    }
    *out = stats;
    return S_OK;
}
SortStatus radix_sort(SItem *a, size_t n, SortStats *out)
{
    SortStatus status = prepare(a, n, out);
    if (status != S_OK) { return status; }
    SortStats stats = {0, 0};
    if (n > 1) {
        SItem *work = malloc(n * sizeof *work);
        if (work == NULL) { return S_MEMORY; }
        for (int factor = 1; factor <= 1000; factor *= 10) {
            size_t counts[10] = {0}, next[10];
            for (size_t i = 0; i < n; i++) { counts[((a[i].key - SORT_LOW) / factor) % 10]++; }
            positions(counts, next, 10);
            for (size_t i = 0; i < n; i++) {
                size_t digit = (size_t)(((a[i].key - SORT_LOW) / factor) % 10);
                sort_write(work, next[digit]++, a[i], &stats);
            }
            for (size_t i = 0; i < n; i++) { sort_write(a, i, work[i], &stats); }
        }
        free(work);
    }
    *out = stats;
    return S_OK;
}
