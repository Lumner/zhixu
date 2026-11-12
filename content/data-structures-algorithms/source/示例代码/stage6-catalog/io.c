#include "io.h"
#include <string.h>
#if TITLE_CAP != TITLE_BYTES
#error Title capacities must agree
#endif
CatStatus v3_hash_status(HStatus status)
{
    switch (status) {
    case H_OK: return CAT_OK;
    case H_DUPLICATE: return CAT_DUPLICATE;
    case H_MISSING: return CAT_NOT_FOUND;
    case H_FULL: return CAT_LIMIT;
    case H_MEMORY: return CAT_MEMORY;
    default: return CAT_INVALID;
    }
}
CatStatus v3_load(FILE *in, IndexedCatalog *catalog)
{
    Catalog parsed;
    catalog_init(&parsed);
    CatStatus status = catalog_load(in, &parsed);
    if (status == CAT_OK) {
        IRecord candidate[RECORD_LIMIT] = {0};
        for (size_t i = 0; i < parsed.count; i++) {
            candidate[i].id = parsed.items[i].id;
            candidate[i].minutes = parsed.items[i].minutes;
            strcpy(candidate[i].title, parsed.items[i].title);
        }
        status = v3_hash_status(indexed_replace(catalog, candidate, parsed.count));
    }
    catalog_free(&parsed);
    return status;
}
CatStatus v3_save(FILE *out, const IndexedCatalog *catalog)
{
    if (catalog->count > RECORD_LIMIT) { return CAT_LIMIT; }
    Catalog serial;
    catalog_init(&serial);
    CatStatus status = CAT_OK;
    for (size_t i = 0; i < catalog->count && status == CAT_OK; i++) {
        Record row = {0};
        row.id = catalog->records[i].id;
        row.minutes = catalog->records[i].minutes;
        strcpy(row.title, catalog->records[i].title);
        status = catalog_add(&serial, &row);
    }
    if (status == CAT_OK) { status = catalog_save(out, &serial); }
    catalog_free(&serial);
    return status;
}
