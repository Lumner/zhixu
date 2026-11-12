#include "catalog.h"
#include "matching.h"
#include <stdio.h>
#include <string.h>
int main(int argc, char **argv)
{
    if (argc > 2) {
        fputs("usage: catalog [title-pattern]\n", stderr);
        return 1;
    }
    const char *pattern = argc == 2 ? argv[1] : "C";
    size_t m = strlen(pattern);
    if (m > MATCH_PATTERN_MAX) {
        fputs("catalog: pattern length\n", stderr);
        return 1;
    }
    IRecord input[] = {{17, 30, "C basics"}, {1, 45, "Pointers in C"}, {9, 20, "Queues"}};
    IndexedCatalog catalog;
    indexed_init(&catalog);
    if (indexed_replace(&catalog, input, 3) != H_OK || indexed_remove(&catalog, 17) != H_OK ||
        indexed_set_minutes(&catalog, 9, 25) != H_OK) {
        indexed_clear(&catalog);
        return 1;
    }
    IRecord found;
    if (indexed_find(&catalog, 9, &found) != H_OK) {
        indexed_clear(&catalog);
        return 1;
    }
    printf("id=%d minutes=%d title=%s\n", found.id, found.minutes, found.title);
    for (size_t i = 0; i < catalog.count; i++) {
        Match match;
        if (kmp_match(catalog.records[i].title, strlen(catalog.records[i].title), pattern, m, &match) != M_OK) {
            indexed_clear(&catalog);
            return 1;
        }
        if (match.found) {
            printf("title_match=%d byte=%zu\n", catalog.records[i].id, match.index);
        }
    }
    printf("count=%zu index_count=%zu\n", catalog.count, catalog.index.count);
    indexed_clear(&catalog);
    return 0;
}
