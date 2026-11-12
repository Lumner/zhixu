#ifndef DSA_CATALOG_H
#define DSA_CATALOG_H

#include <stddef.h>
#include <stdio.h>

#define TITLE_CAP 64
#define RECORD_LIMIT 32

typedef struct {
    int id;
    int minutes;
    char title[TITLE_CAP];
} Record;

typedef struct {
    Record *items;
    size_t count;
    size_t capacity;
} Catalog;

typedef enum {
    CAT_OK, CAT_INVALID, CAT_DUPLICATE, CAT_LIMIT,
    CAT_MEMORY, CAT_IO, CAT_NOT_FOUND
} CatStatus;

void catalog_init(Catalog *catalog);
void catalog_free(Catalog *catalog);
CatStatus catalog_add(Catalog *catalog, const Record *record);
const Record *catalog_find(const Catalog *catalog, int id);
CatStatus catalog_set_minutes(Catalog *catalog, int id, int minutes);
CatStatus catalog_load(FILE *in, Catalog *catalog);
CatStatus catalog_save(FILE *out, const Catalog *catalog);
int parse_number(const char *text, int limit, int *out);
const char *catalog_status_name(CatStatus status);

#endif
