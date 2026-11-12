#ifndef DSA_CATALOG_V3_IO_H
#define DSA_CATALOG_V3_IO_H
#include "../stage2-catalog/catalog.h"
#include "../stage5-indexed-catalog/catalog.h"
CatStatus v3_hash_status(HStatus status);
CatStatus v3_load(FILE *in, IndexedCatalog *catalog);
CatStatus v3_save(FILE *out, const IndexedCatalog *catalog);
#endif
