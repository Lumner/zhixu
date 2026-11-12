#include "io.h"
#include "view.h"
#include "matching.h"
#include <string.h>
static void print_record(const IRecord *record)
{
    printf("id=%d minutes=%d title=%s\n", record->id, record->minutes, record->title);
}
int main(int argc, char **argv)
{
    if (argc < 3) { fputs("usage: catalog-v3 view|save|find|title|remove input [arguments]\n", stderr); return 1; }
    const char *mode = argv[1];
    int view = strcmp(mode, "view") == 0, save = strcmp(mode, "save") == 0;
    int find = strcmp(mode, "find") == 0, title = strcmp(mode, "title") == 0, remove = strcmp(mode, "remove") == 0;
    if (!((view && argc == 3) || (save && (argc == 3 || argc == 5)) || ((find || title || remove) && argc == 4))) {
        fputs("usage: catalog-v3 view|save|find|title|remove input [arguments]\n", stderr); return 1;
    }
    int id = 0, minutes = 0;
    if (((find || remove || (save && argc == 5)) && !parse_number(argv[3], 9999, &id)) ||
        (save && argc == 5 && !parse_number(argv[4], 1440, &minutes)) ||
        (title && strlen(argv[3]) > MATCH_PATTERN_MAX)) {
        fputs("v3: invalid arguments\n", stderr); return 1;
    }
    FILE *in = fopen(argv[2], "rb");
    if (in == NULL) { fputs("v3: open failed\n", stderr); return 1; }
    IndexedCatalog catalog;
    indexed_init(&catalog);
    CatStatus status = v3_load(in, &catalog);
    if (fclose(in) != 0 && status == CAT_OK) { status = CAT_IO; }
    if (status == CAT_OK && save && argc == 5) { status = v3_hash_status(indexed_set_minutes(&catalog, id, minutes)); }
    if (status == CAT_OK && remove) { status = v3_hash_status(indexed_remove(&catalog, id)); }
    if (status == CAT_OK) {
        if (save || remove) { status = v3_save(stdout, &catalog); }
        else if (view) {
            IRecord sorted[H_MAX_ITEMS]; SortStats stats;
            SortStatus sorted_status = catalog_view(&catalog, sorted, H_MAX_ITEMS, &stats);
            if (sorted_status != S_OK) { status = sorted_status == S_MEMORY ? CAT_MEMORY : CAT_INVALID; }
            else { for (size_t i = 0; i < catalog.count; i++) { print_record(&sorted[i]); } }
        }
        else if (find) {
            IRecord found;
            status = v3_hash_status(indexed_find(&catalog, id, &found));
            if (status == CAT_OK) { print_record(&found); }
        }
        else {
            for (size_t i = 0; i < catalog.count; i++) {
                Match match;
                (void)kmp_match(catalog.records[i].title, strlen(catalog.records[i].title), argv[3], strlen(argv[3]), &match);
                if (match.found) { print_record(&catalog.records[i]); }
            }
        }
    }
    if (status == CAT_OK && (ferror(stdout) || fflush(stdout) != 0)) { status = CAT_IO; }
    indexed_clear(&catalog);
    if (status != CAT_OK) { fprintf(stderr, "v3: %s\n", catalog_status_name(status)); return 1; }
    return 0;
}
