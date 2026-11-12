#include "catalog.h"
#include <string.h>

static int valid_record(const IRecord *record)
{
    if (record->id < 0 || record->id > H_KEY_MAX || record->minutes < 0 || record->minutes > 1440) {
        return 0;
    }
    for (size_t i = 0; i < TITLE_BYTES; i++) {
        unsigned char byte = (unsigned char)record->title[i];
        if (byte == 0) {
            return i != 0;
        }
        if (byte < 32 || byte == 127) {
            return 0;
        }
    }
    return 0;
}
void indexed_init(IndexedCatalog *catalog)
{
    catalog->count = 0;
    open_init(&catalog->index);
}
void indexed_clear(IndexedCatalog *catalog)
{
    open_clear(&catalog->index);
    catalog->count = 0;
}
HStatus indexed_replace(IndexedCatalog *catalog, const IRecord *records, size_t count)
{
    if ((count != 0 && records == NULL) || count > H_MAX_ITEMS) {
        return H_INVALID;
    }
    IRecord candidate[H_MAX_ITEMS];
    OpenMap next;
    open_init(&next);
    for (size_t i = 0; i < count; i++) {
        if (!valid_record(&records[i])) {
            open_clear(&next);
            return H_INVALID;
        }
        candidate[i] = records[i];
        HStatus status = open_put(&next, candidate[i].id, (int)i);
        if (status != H_OK) {
            open_clear(&next);
            return status;
        }
    }
    for (size_t i = 0; i < count; i++) {
        catalog->records[i] = candidate[i];
    }
    open_clear(&catalog->index);
    catalog->index = next;
    catalog->count = count;
    return H_OK;
}
HStatus indexed_add(IndexedCatalog *catalog, const IRecord *record)
{
    if (record == NULL || !valid_record(record)) {
        return H_INVALID;
    }
    int position;
    if (open_get(&catalog->index, record->id, &position) == H_OK) {
        return H_DUPLICATE;
    }
    if (catalog->count == H_MAX_ITEMS) {
        return H_FULL;
    }
    IRecord candidate[H_MAX_ITEMS];
    for (size_t i = 0; i < catalog->count; i++) {
        candidate[i] = catalog->records[i];
    }
    candidate[catalog->count] = *record;
    return indexed_replace(catalog, candidate, catalog->count + 1);
}
HStatus indexed_remove(IndexedCatalog *catalog, int id)
{
    int position;
    HStatus status = open_get(&catalog->index, id, &position);
    if (status != H_OK) {
        return status;
    }
    IRecord candidate[H_MAX_ITEMS];
    size_t n = 0;
    for (size_t i = 0; i < catalog->count; i++) {
        if (i != (size_t)position) {
            candidate[n++] = catalog->records[i];
        }
    }
    return indexed_replace(catalog, candidate, n);
}
HStatus indexed_find(const IndexedCatalog *catalog, int id, IRecord *out)
{
    if (out == NULL) {
        return H_INVALID;
    }
    int position;
    HStatus status = open_get(&catalog->index, id, &position);
    if (status != H_OK) {
        return status;
    }
    *out = catalog->records[position];
    return H_OK;
}
HStatus indexed_set_minutes(IndexedCatalog *catalog, int id, int minutes)
{
    if (minutes < 0 || minutes > 1440) {
        return H_INVALID;
    }
    int position;
    HStatus status = open_get(&catalog->index, id, &position);
    if (status != H_OK) {
        return status;
    }
    catalog->records[position].minutes = minutes;
    return H_OK;
}
