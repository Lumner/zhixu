#include "catalog.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

typedef enum { LINE_OK, LINE_END, LINE_BAD, LINE_IO } LineStatus;

static LineStatus read_line(FILE *in, char *line, size_t capacity)
{
    size_t length = 0;
    int bad = 0;
    int ch;
    while ((ch = fgetc(in)) != EOF && ch != '\n') {
        if (ch == '\r') {
            ch = fgetc(in);
            if (ch == '\n') {
                break;
            }
            bad = 1;
            if (ch == EOF) {
                break;
            }
        }
        if (ch < 32 || ch == 127) {
            bad = 1;
        }
        if (length < capacity - 1) {
            line[length++] = (char)ch;
        } else {
            bad = 1;
        }
    }
    line[length] = '\0';
    if (ferror(in)) {
        return LINE_IO;
    }
    if (ch == EOF && length == 0 && !bad) {
        return LINE_END;
    }
    return bad ? LINE_BAD : LINE_OK;
}

int parse_number(const char *text, int limit, int *out)
{
    if (text == NULL || out == NULL || limit < 0 || text[0] == '\0') {
        return 0;
    }
    int value = 0;
    for (size_t i = 0; text[i] != '\0'; i++) {
        if (text[i] < '0' || text[i] > '9') {
            return 0;
        }
        int digit = text[i] - '0';
        if (value > limit / 10 ||
            (value == limit / 10 && digit > limit % 10)) {
            return 0;
        }
        value = value * 10 + digit;
    }
    *out = value;
    return 1;
}

void catalog_init(Catalog *catalog)
{
    catalog->items = NULL;
    catalog->count = 0;
    catalog->capacity = 0;
}

void catalog_free(Catalog *catalog)
{
    free(catalog->items);
    catalog_init(catalog);
}

const Record *catalog_find(const Catalog *catalog, int id)
{
    for (size_t i = 0; i < catalog->count; i++) {
        if (catalog->items[i].id == id) {
            return &catalog->items[i];
        }
    }
    return NULL;
}

static int valid_record(const Record *record)
{
    if (record->id < 0 || record->id > 9999 ||
        record->minutes < 0 || record->minutes > 1440) {
        return 0;
    }
    for (size_t i = 0; i < TITLE_CAP; i++) {
        unsigned char ch = (unsigned char)record->title[i];
        if (ch == '\0') {
            return i > 0;
        }
        if (ch < 32 || ch == 127) {
            return 0;
        }
    }
    return 0;
}

CatStatus catalog_add(Catalog *catalog, const Record *record)
{
    Record copy = *record;
    if (!valid_record(&copy)) {
        return CAT_INVALID;
    }
    if (catalog_find(catalog, copy.id) != NULL) {
        return CAT_DUPLICATE;
    }
    if (catalog->count == RECORD_LIMIT) {
        return CAT_LIMIT;
    }
    if (catalog->count == catalog->capacity) {
        size_t next = catalog->capacity == 0 ? 4 : catalog->capacity * 2;
        if (next > RECORD_LIMIT) {
            next = RECORD_LIMIT;
        }
        if (next > SIZE_MAX / sizeof *catalog->items) {
            return CAT_MEMORY;
        }
        Record *grown = realloc(catalog->items, next * sizeof *catalog->items);
        if (grown == NULL) {
            return CAT_MEMORY;
        }
        catalog->items = grown;
        catalog->capacity = next;
    }
    catalog->items[catalog->count] = copy;
    catalog->count++;
    return CAT_OK;
}

CatStatus catalog_set_minutes(Catalog *catalog, int id, int minutes)
{
    if (minutes < 0 || minutes > 1440) {
        return CAT_INVALID;
    }
    for (size_t i = 0; i < catalog->count; i++) {
        if (catalog->items[i].id == id) {
            catalog->items[i].minutes = minutes;
            return CAT_OK;
        }
    }
    return CAT_NOT_FOUND;
}

CatStatus catalog_load(FILE *in, Catalog *catalog)
{
    Catalog incoming;
    catalog_init(&incoming);
    char line[TITLE_CAP];
    LineStatus line_status = read_line(in, line, sizeof line);
    CatStatus status = CAT_OK;
    if (line_status != LINE_OK || strcmp(line, "DSA-CATALOG-1") != 0) {
        status = line_status == LINE_IO ? CAT_IO : CAT_INVALID;
    }
    while (status == CAT_OK) {
        line_status = read_line(in, line, sizeof line);
        if (line_status == LINE_END) {
            break;
        }
        Record record = {0};
        if (line_status != LINE_OK || !parse_number(line, 9999, &record.id)) {
            status = line_status == LINE_IO ? CAT_IO : CAT_INVALID;
            break;
        }
        line_status = read_line(in, line, sizeof line);
        if (line_status != LINE_OK || !parse_number(line, 1440, &record.minutes)) {
            status = line_status == LINE_IO ? CAT_IO : CAT_INVALID;
            break;
        }
        line_status = read_line(in, record.title, sizeof record.title);
        if (line_status != LINE_OK) {
            status = line_status == LINE_IO ? CAT_IO : CAT_INVALID;
            break;
        }
        status = catalog_add(&incoming, &record);
    }
    if (status != CAT_OK) {
        catalog_free(&incoming);
        return status;
    }
    catalog_free(catalog);
    *catalog = incoming;
    return CAT_OK;
}

CatStatus catalog_save(FILE *out, const Catalog *catalog)
{
    if (fprintf(out, "DSA-CATALOG-1\n") < 0) {
        return CAT_IO;
    }
    for (size_t i = 0; i < catalog->count; i++) {
        const Record *record = &catalog->items[i];
        if (fprintf(out, "%d\n%d\n%s\n", record->id, record->minutes, record->title) < 0) {
            return CAT_IO;
        }
    }
    return fflush(out) == 0 ? CAT_OK : CAT_IO;
}

const char *catalog_status_name(CatStatus status)
{
    switch (status) {
    case CAT_OK: return "ok";
    case CAT_INVALID: return "invalid data";
    case CAT_DUPLICATE: return "duplicate id";
    case CAT_LIMIT: return "record limit";
    case CAT_MEMORY: return "out of memory";
    case CAT_IO: return "I/O error";
    case CAT_NOT_FOUND: return "not found";
    default: return "unknown";
    }
}
