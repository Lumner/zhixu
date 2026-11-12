#ifndef DSA_CATALOG_VIEW_H
#define DSA_CATALOG_VIEW_H
#include "../stage5-indexed-catalog/catalog.h"
#include "sort.h"
SortStatus catalog_view(const IndexedCatalog *catalog, IRecord *out, size_t capacity, SortStats *stats);
#endif
