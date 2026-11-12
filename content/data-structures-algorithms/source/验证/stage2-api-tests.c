#include "catalog.h"
#include <assert.h>
#include <stdlib.h>
#include <string.h>

void lab_reset(int allocation, int read, int write, int flush);
int lab_live(void);

int main(int argc, char *argv[])
{
    assert(argc == 2);
    Catalog catalog;
    catalog_init(&catalog);
    Record record = {7, 30, "old"};
    assert(catalog_add(&catalog, &record) == CAT_OK);
    assert(lab_live() == 1);
    record.title[0] = 'X';
    assert(strcmp(catalog_find(&catalog, 7)->title, "old") == 0);
    assert(catalog_set_minutes(&catalog, 7, 1440) == CAT_OK);
    assert(catalog_set_minutes(&catalog, 7, 1441) == CAT_INVALID);
    assert(catalog_set_minutes(&catalog, 8, 1) == CAT_NOT_FOUND);
    assert(catalog_find(&catalog, 7)->minutes == 1440);
    assert(catalog_add(&catalog, catalog_find(&catalog, 7)) == CAT_DUPLICATE);

    for (int attempt = 0; attempt < 4; attempt++) {
        FILE *in = fopen(argv[1], "rb");
        assert(in != NULL);
        lab_reset(attempt < 2 ? attempt + 1 : 0,
                  attempt == 2 ? 1 : attempt == 3 ? 25 : 0, 0, 0);
        CatStatus status = catalog_load(in, &catalog);
        assert(status == (attempt < 2 ? CAT_MEMORY : CAT_IO));
        assert(fclose(in) == 0);
        assert(catalog.count == 1 && catalog.items[0].id == 7);
        assert(catalog.items[0].minutes == 1440);
        assert(strcmp(catalog.items[0].title, "old") == 0);
        assert(lab_live() == 1);
    }
    lab_reset(0, 0, 0, 0);
    const char *bad_files[] = {
        "DSA-CATALOG-1\n1\n30\nok\n1\n40\ndup\n",
        "DSA-CATALOG-1\n1\n30\nok\n2\n40\n",
        "DSA-CATALOG-1\n1\n30\nok\n2\n1441\nbad\n"
    };
    for (size_t i = 0; i < 3; i++) {
        FILE *in = fopen("stage2-test-input.tmp", "w+b");
        assert(in != NULL);
        assert(fputs(bad_files[i], in) >= 0);
        rewind(in);
        assert(catalog_load(in, &catalog) == (i == 0 ? CAT_DUPLICATE : CAT_INVALID));
        assert(catalog.count == 1 && catalog.items[0].id == 7);
        assert(catalog.items[0].minutes == 1440 && lab_live() == 1);
        assert(fclose(in) == 0);
    }
    for (int attempt = 0; attempt < 3; attempt++) {
        FILE *out = fopen("stage2-test-output.tmp", "w+b");
        assert(out != NULL);
        lab_reset(0, 0, attempt < 2 ? attempt + 1 : 0, attempt == 2);
        assert(catalog_save(out, &catalog) == CAT_IO);
        assert(fclose(out) == 0);
        assert(lab_live() == 1);
    }
    lab_reset(0, 0, 0, 0);
    catalog_free(&catalog);
    assert(lab_live() == 0);

    for (int id = 0; id < RECORD_LIMIT; id++) {
        Record next = {0, 30, "entry"};
        next.id = id;
        assert(catalog_add(&catalog, &next) == CAT_OK);
        assert(catalog.count == (size_t)id + 1);
        assert(catalog.count <= catalog.capacity && catalog.capacity <= RECORD_LIMIT);
    }
    Record extra = {99, 1, "extra"};
    assert(catalog_add(&catalog, &extra) == CAT_LIMIT);
    extra.id = 1;
    assert(catalog_add(&catalog, &extra) == CAT_DUPLICATE);
    extra.id = 99;
    extra.title[0] = '\0';
    assert(catalog_add(&catalog, &extra) == CAT_INVALID);
    memset(extra.title, 'a', TITLE_CAP);
    assert(catalog_add(&catalog, &extra) == CAT_INVALID);
    catalog_free(&catalog);
    catalog_free(&catalog);
    assert(lab_live() == 0);

    int parsed = 999;
    assert(!parse_number("1441", 1440, &parsed) && parsed == 999);
    assert(!parse_number(NULL, 10, &parsed));
    assert(!parse_number("1", 10, NULL));
    assert(!parse_number("1", -1, &parsed));
    assert(parse_number("0007", 7, &parsed) && parsed == 7);
    assert(!parse_number("8", 7, &parsed) && parsed == 7);
    puts("api and failure paths passed");
    return 0;
}
