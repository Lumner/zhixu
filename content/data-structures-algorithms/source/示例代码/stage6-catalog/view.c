#include "view.h"
SortStatus catalog_view(const IndexedCatalog *catalog, IRecord *out, size_t capacity, SortStats *stats)
{
    if (stats == NULL || (catalog->count != 0 && out == NULL)) { return S_INVALID; }
    if (capacity < catalog->count) { return S_RANGE; }
    SItem order[H_MAX_ITEMS];
    for (size_t i = 0; i < catalog->count; i++) {
        order[i].key = catalog->records[i].minutes;
        order[i].tag = (int)i;
    }
    SortStats measured;
    SortStatus status = merge_sort(order, catalog->count, &measured);
    if (status != S_OK) { return status; }
    for (size_t i = 0; i < catalog->count; i++) { out[i] = catalog->records[order[i].tag]; }
    *stats = measured;
    return S_OK;
}
