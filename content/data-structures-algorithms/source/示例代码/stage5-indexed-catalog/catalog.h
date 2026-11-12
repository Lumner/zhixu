#ifndef DSA_INDEXED_CATALOG_H
#define DSA_INDEXED_CATALOG_H
#include "open_map.h"
#define TITLE_BYTES 64
typedef struct { int id; int minutes; char title[TITLE_BYTES]; } IRecord;
typedef struct { IRecord records[H_MAX_ITEMS]; size_t count; OpenMap index; } IndexedCatalog;
void indexed_init(IndexedCatalog *catalog);
void indexed_clear(IndexedCatalog *catalog);
HStatus indexed_replace(IndexedCatalog *catalog, const IRecord *records, size_t count);
HStatus indexed_add(IndexedCatalog *catalog, const IRecord *record);
HStatus indexed_remove(IndexedCatalog *catalog, int id);
HStatus indexed_find(const IndexedCatalog *catalog, int id, IRecord *out);
HStatus indexed_set_minutes(IndexedCatalog *catalog, int id, int minutes);
#endif
