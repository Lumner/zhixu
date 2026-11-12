#include "catalog.h"
#include <stdio.h>

int main(int argc, char *argv[])
{
    if (argc != 2 && argc != 4) {
        fputs("usage: catalog input-file [id minutes]\n", stderr);
        return 1;
    }
    int id = 0;
    int minutes = 0;
    if (argc == 4 && (!parse_number(argv[2], 9999, &id) ||
                      !parse_number(argv[3], 1440, &minutes))) {
        fputs("invalid arguments\n", stderr);
        return 1;
    }
    FILE *in = fopen(argv[1], "rb");
    if (in == NULL) {
        fputs("open failed\n", stderr);
        return 1;
    }
    Catalog catalog;
    catalog_init(&catalog);
    CatStatus status = catalog_load(in, &catalog);
    if (fclose(in) != 0 && status == CAT_OK) {
        status = CAT_IO;
    }
    if (status == CAT_OK && argc == 4) {
        status = catalog_set_minutes(&catalog, id, minutes);
    }
    if (status == CAT_OK) {
        status = catalog_save(stdout, &catalog);
    }
    catalog_free(&catalog);
    if (status != CAT_OK) {
        fprintf(stderr, "catalog: %s\n", catalog_status_name(status));
        return 1;
    }
    return 0;
}
