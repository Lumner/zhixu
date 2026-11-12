#include "stage6-test.h"
#include "experiment.h"
#include "view.h"
#include "io.h"
#include <limits.h>
#include <string.h>
typedef struct { SItem item; size_t position; } Oracle;
static int oracle_compare(const void *left, const void *right)
{
    const Oracle *a = left, *b = right;
    if (a->item.key != b->item.key) { return a->item.key < b->item.key ? -1 : 1; }
    return a->position < b->position ? -1 : a->position > b->position ? 1 : 0;
}
static int item_equal(SItem a, SItem b) { return a.key == b.key && a.tag == b.tag; }
static void check_sort(const SItem *input, size_t n, size_t algorithm)
{
    SItem guarded[SORT_MAX + 2]; Oracle reference[SORT_MAX];
    guarded[0] = (SItem){INT_MIN, 777}; guarded[n + 1] = (SItem){INT_MAX, -777};
    for (size_t i = 0; i < n; i++) {
        guarded[i + 1] = input[i]; reference[i].item = input[i]; reference[i].position = i;
    }
    qsort(reference, n, sizeof *reference, oracle_compare);
    SortStats stats = {999, 999};
    REQUIRE(experiment_run(algorithm, guarded + 1, n, &stats) == S_OK, "sort status");
    REQUIRE(item_equal(guarded[0], (SItem){INT_MIN, 777}) && item_equal(guarded[n + 1], (SItem){INT_MAX, -777}), "sort boundary canaries");
    int seen[SORT_MAX] = {0};
    for (size_t i = 0; i < n; i++) {
        REQUIRE(guarded[i + 1].key == reference[i].item.key, "qsort key oracle");
        size_t found = 0;
        while (found < n && (seen[found] || !item_equal(input[found], guarded[i + 1]))) { found++; }
        REQUIRE(found < n, "identity multiset oracle"); seen[found] = 1;
        if (algorithm_is_stable(algorithm)) { REQUIRE(item_equal(guarded[i + 1], reference[i].item), "stable order oracle"); }
    }
    REQUIRE(s6_live == 0, "sort workspace released");
}
static unsigned long random_state = 20261111UL;
static unsigned int random_word(void)
{
    random_state = (random_state * 1664525UL + 1013904223UL) % 4294967296UL;
    return (unsigned int)(random_state / 65536UL);
}
static size_t sort_cases(void)
{
    size_t cases = 0, words = 1;
    for (size_t n = 0; n <= 8; n++) {
        for (size_t code = 0; code < words; code++) {
            SItem input[SORT_MAX]; size_t value = code;
            for (size_t i = 0; i < n; i++) { input[i].key = (int)(value % 3) - 1; input[i].tag = 100 - (int)i; value /= 3; }
            for (size_t k = 0; k < ALGORITHM_COUNT; k++) { check_sort(input, n, k); cases++; }
        }
        words *= 3;
    }
    for (size_t trial = 0; trial < 500; trial++) {
        SItem input[SORT_MAX]; size_t n = random_word() % (SORT_MAX + 1);
        for (size_t i = 0; i < n; i++) { input[i].key = (int)(random_word() % 1999) - 999; input[i].tag = (int)i * 3 - 200; }
        for (size_t k = 0; k < ALGORITHM_COUNT; k++) { check_sort(input, n, k); cases++; }
    }
    for (size_t dataset = 0; dataset < DATASET_COUNT; dataset++) {
        SItem input[SORT_MAX]; experiment_data(dataset, input, SORT_MAX);
        for (size_t k = 0; k < ALGORITHM_COUNT; k++) { check_sort(input, SORT_MAX, k); cases++; }
    }
    const SItem extremes[] = {{INT_MAX, 5}, {0, 4}, {INT_MIN, 3}, {INT_MAX, 2}, {INT_MIN, 1}};
    for (size_t k = 0; k < 6; k++) { check_sort(extremes, 5, k); cases++; }
    for (size_t k = 0; k < ALGORITHM_COUNT; k++) {
        SItem a[SORT_MAX + 1] = {{0, 123}}; SortStats stats = {777, 888};
        REQUIRE(experiment_run(k, NULL, 0, &stats) == S_OK && stats.comparisons == 0 && stats.writes == 0, "empty sort");
        stats = (SortStats){777, 888};
        REQUIRE(experiment_run(k, NULL, 1, &stats) == S_INVALID && stats.writes == 888, "null positive input");
        REQUIRE(experiment_run(k, a, 1, NULL) == S_INVALID, "null statistics");
        REQUIRE(experiment_run(k, a, SORT_MAX + 1, &stats) == S_RANGE && stats.writes == 888 && a[0].tag == 123, "oversized preserves");
    }
    for (size_t k = 6; k < 9; k++) {
        const int bad_keys[] = {-1000, 1000, INT_MIN, INT_MAX};
        for (size_t i = 0; i < 4; i++) {
            SItem bad[] = {{0, 4}, {bad_keys[i], 7}}, saved[2]; memcpy(saved, bad, sizeof bad);
            SortStats stats = {777, 888};
            REQUIRE(experiment_run(k, bad, 2, &stats) == S_RANGE && stats.comparisons == 777 && stats.writes == 888, "range statistics preserved");
            REQUIRE(item_equal(bad[0], saved[0]) && item_equal(bad[1], saved[1]), "range input preserved");
        }
        SItem edge[] = {{999, -7}, {-999, -8}, {999, -9}}; check_sort(edge, 3, k); cases++;
    }
    return cases;
}
static void counting_checks(void)
{
    SItem input[32]; SortStats stats;
    experiment_data(0, input, 32);
    REQUIRE(selection_sort(input, 32, &stats) == S_OK && stats.comparisons == 496 && stats.writes == 0, "selection triangular comparisons");
    REQUIRE(bubble_sort(input, 32, &stats) == S_OK && stats.comparisons == 31 && stats.writes == 0, "bubble early stop");
    REQUIRE(insertion_sort(input, 32, &stats) == S_OK && stats.comparisons == 31 && stats.writes == 31, "insertion sorted counts");
    REQUIRE(merge_sort(input, 32, &stats) == S_OK && stats.comparisons == 80 && stats.writes == 320, "merge power two counts");
    experiment_data(1, input, 32);
    REQUIRE(insertion_sort(input, 32, &stats) == S_OK && stats.comparisons == 496 && stats.writes == 527, "insertion reverse counts");
    experiment_data(2, input, 32);
    REQUIRE(quick_sort(input, 32, &stats) == S_OK && stats.comparisons == 32 && stats.writes == 0, "three way all equal");
    REQUIRE(counting_sort(input, 32, &stats) == S_OK && stats.comparisons == 0 && stats.writes == 64, "counting record writes");
    REQUIRE(radix_sort(input, 32, &stats) == S_OK && stats.comparisons == 0 && stats.writes == 256, "radix four passes");
    SItem before[] = {{1, 10}, {1, 11}, {2, 12}};
    SItem reversed[] = {{1, 11}, {1, 10}, {2, 12}};
    SItem lost[] = {{1, 10}, {1, 10}, {2, 12}};
    REQUIRE(experiment_check(before, reversed, 3, 0) && !experiment_check(before, reversed, 3, 1), "checker distinguishes stability");
    REQUIRE(!experiment_check(before, lost, 3, 0), "checker rejects sorted but lost identity");
}
static int record_equal(const IRecord *a, const IRecord *b)
{
    return a->id == b->id && a->minutes == b->minutes && strcmp(a->title, b->title) == 0;
}
static void catalog_state(const IndexedCatalog *c, const IRecord *expected, size_t n)
{
    REQUIRE(c->count == n && c->index.count == n, "catalog count");
    for (size_t i = 0; i < n; i++) {
        IRecord out; int pos;
        REQUIRE(record_equal(&c->records[i], &expected[i]), "catalog original order");
        REQUIRE(indexed_find(c, expected[i].id, &out) == H_OK && record_equal(&out, &expected[i]), "catalog query identity");
        REQUIRE(open_get(&c->index, expected[i].id, &pos) == H_OK && pos == (int)i, "catalog index position");
    }
}
static FILE *data_file(const IRecord *records, size_t n)
{
    FILE *file = fopen("stage6-test-input.txt", "w+b"); REQUIRE(file != NULL, "open local temporary input");
    REQUIRE(fputs("DSA-CATALOG-1\n", file) >= 0, "write header");
    for (size_t i = 0; i < n; i++) { REQUIRE(fprintf(file, "%d\n%d\n%s\n", records[i].id, records[i].minutes, records[i].title) > 0, "write fixture"); }
    REQUIRE(fflush(file) == 0 && fseek(file, 0, SEEK_SET) == 0, "rewind fixture");
    return file;
}
static size_t catalog_cases(void)
{
    size_t cases = 0;
    for (size_t n = 0; n <= RECORD_LIMIT; n++) {
        IRecord input[H_MAX_ITEMS] = {0};
        for (size_t i = 0; i < n; i++) {
            input[i].id = (int)i * 64; input[i].minutes = (int)((i * 17) % 5) * 30;
            (void)snprintf(input[i].title, TITLE_BYTES, "lesson-%zu", i);
        }
        IndexedCatalog c; indexed_init(&c);
        FILE *file = data_file(input, n);
        REQUIRE(v3_load(file, &c) == CAT_OK && fclose(file) == 0, "load and build index");
        catalog_state(&c, input, n);
        HSlot *slots = c.index.slots;
        IRecord view[H_MAX_ITEMS]; SortStats stats;
        REQUIRE(catalog_view(&c, view, H_MAX_ITEMS, &stats) == S_OK, "view succeeds");
        catalog_state(&c, input, n); REQUIRE(c.index.slots == slots, "view preserves index address");
        size_t used[H_MAX_ITEMS] = {0}, previous = 0;
        for (size_t i = 0; i < n; i++) {
            size_t pos = 0;
            while (pos < n && !record_equal(&view[i], &input[pos])) { pos++; }
            REQUIRE(pos < n && !used[pos], "view permutation"); used[pos] = 1;
            if (i > 0) {
                REQUIRE(view[i - 1].minutes <= view[i].minutes, "view minutes sorted");
                if (view[i - 1].minutes == view[i].minutes) { REQUIRE(previous < pos, "view stable ties"); }
            }
            previous = pos;
        }
        file = fopen("stage6-test-output.txt", "w+b"); REQUIRE(file != NULL, "open export");
        REQUIRE(v3_save(file, &c) == CAT_OK && fseek(file, 0, SEEK_SET) == 0, "export canonical");
        IndexedCatalog loaded; indexed_init(&loaded);
        REQUIRE(v3_load(file, &loaded) == CAT_OK && fclose(file) == 0, "reload export");
        catalog_state(&loaded, input, n);
        indexed_clear(&loaded); indexed_clear(&c);
        REQUIRE(s6_live == 0, "catalog roundtrip release"); cases++;
    }
    return cases;
}
static size_t failures(void)
{
    size_t cases = 0;
    const size_t allocating[] = {4, 6, 7, 8};
    for (size_t k = 0; k < 4; k++) {
        SItem input[] = {{3, 1}, {1, 2}, {2, 3}}; SortStats stats = {777, 888};
        s6_fail_after(0);
        REQUIRE(experiment_run(allocating[k], input, 3, &stats) == S_MEMORY, "sort allocation failure");
        REQUIRE(input[0].key == 3 && input[1].key == 1 && input[2].key == 2 && stats.comparisons == 777 && stats.writes == 888, "allocation preserves input and stats");
        REQUIRE(s6_live == 0, "no failed workspace"); cases++;
        REQUIRE(experiment_run(allocating[k], input, 1, &stats) == S_OK && stats.writes == 0, "singleton needs no allocation");
        s6_fail_after(-1);
    }
    const IRecord base[] = {{17, 30, "C"}, {9, 30, "Queues"}, {3, 10, "Arrays"}};
    IndexedCatalog c; indexed_init(&c); REQUIRE(indexed_replace(&c, base, 3) == H_OK, "failure base");
    IRecord out[H_MAX_ITEMS] = {{9999, 123, "unchanged"}}; SortStats stats = {777, 888}; HSlot *slots = c.index.slots;
    s6_fail_after(0);
    REQUIRE(catalog_view(&c, out, H_MAX_ITEMS, &stats) == S_MEMORY && out[0].id == 9999 && stats.writes == 888, "view failure preserves outputs");
    s6_fail_after(-1); catalog_state(&c, base, 3); REQUIRE(c.index.slots == slots, "view old index"); cases++;
    REQUIRE(catalog_view(&c, out, 2, &stats) == S_RANGE && out[0].id == 9999, "view short output");
    REQUIRE(catalog_view(&c, NULL, 3, &stats) == S_INVALID && catalog_view(&c, out, 3, NULL) == S_INVALID, "view null output");
    IRecord incoming[H_MAX_ITEMS] = {0};
    for (int i = 0; i < H_MAX_ITEMS; i++) {
        incoming[i].id = i * 64; incoming[i].minutes = i;
        (void)snprintf(incoming[i].title, TITLE_BYTES, "new-%d", i);
    }
    FILE *file = data_file(incoming, 32);
    size_t before = s6_attempts;
    REQUIRE(v3_load(file, &c) == CAT_OK, "measure load allocation path");
    size_t load_allocations = s6_attempts - before; REQUIRE(fclose(file) == 0, "close measured input");
    REQUIRE(indexed_replace(&c, base, 3) == H_OK, "restore load base");
    for (size_t fail = 0; fail < load_allocations; fail++) {
        file = data_file(incoming, 32); slots = c.index.slots; size_t live = s6_live;
        s6_fail_after((long)fail);
        REQUIRE(v3_load(file, &c) == CAT_MEMORY, "file to index allocation failure");
        s6_fail_after(-1); REQUIRE(fclose(file) == 0, "close failed load input");
        REQUIRE(c.index.slots == slots && s6_live == live, "failed file candidate clean"); catalog_state(&c, base, 3); cases++;
    }
    file = data_file(incoming, 33);
    REQUIRE(v3_load(file, &c) == CAT_LIMIT && fclose(file) == 0, "file record limit"); catalog_state(&c, base, 3);
    incoming[31].id = incoming[0].id; file = data_file(incoming, 32);
    REQUIRE(v3_load(file, &c) == CAT_DUPLICATE && fclose(file) == 0, "duplicate file keeps catalog"); catalog_state(&c, base, 3);
    incoming[31].id = 31 * 64;
    REQUIRE(indexed_replace(&c, incoming, 32) == H_OK, "export failure base");
    file = fopen("stage6-test-output.txt", "w+b"); REQUIRE(file != NULL, "open measured output");
    before = s6_attempts; REQUIRE(v3_save(file, &c) == CAT_OK, "measure export allocations");
    size_t save_allocations = s6_attempts - before; REQUIRE(fclose(file) == 0, "close measured output");
    for (size_t fail = 0; fail < save_allocations; fail++) {
        file = fopen("stage6-test-output.txt", "w+b"); REQUIRE(file != NULL, "open failure output");
        size_t live = s6_live; s6_fail_after((long)fail);
        REQUIRE(v3_save(file, &c) == CAT_MEMORY, "export preparation failure");
        s6_fail_after(-1);
        REQUIRE(ftell(file) == 0 && fclose(file) == 0 && s6_live == live, "no export before preparation complete");
        catalog_state(&c, incoming, 32); cases++;
    }
    REQUIRE(indexed_replace(&c, incoming, 33) == H_OK, "independent memory budget");
    file = fopen("stage6-test-output.txt", "w+b"); REQUIRE(file != NULL, "open over limit output");
    REQUIRE(v3_save(file, &c) == CAT_LIMIT && ftell(file) == 0 && fclose(file) == 0, "file adapter limit distinct from memory");
    indexed_clear(&c); REQUIRE(s6_live == 0, "failure owners release");
    return cases;
}
int main(void)
{
    size_t sorts = sort_cases(); counting_checks(); size_t catalogs = catalog_cases(); size_t fails = failures();
    printf("sort_runs=%zu catalog_roundtrips=%zu allocation_failures=%zu live=%zu\n", sorts, catalogs, fails, s6_live);
    return 0;
}
