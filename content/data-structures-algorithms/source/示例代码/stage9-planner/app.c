#include "planner_internal.h"
#include <string.h>
void planner_init(Planner *app)
{
    memset(app, 0, sizeof(*app));
    indexed_init(&app->catalog);
    for (size_t i = 0; i < RECORD_LIMIT; i++) { app->membership[i] = P_CLASSES; }
    (void)graph_init(&app->study, 0, 1);
    (void)graph_init(&app->roads, 0, 0);
}
void planner_clear(Planner *app)
{
    indexed_clear(&app->catalog);
    planner_init(app);
}
static void swap_owners(Planner *left, Planner *right)
{
    Planner temporary = *left;
    *left = *right;
    *right = temporary;
}
PStatus planner_number(const char *text, int limit, int *out)
{
    if (text == NULL || out == NULL || limit < 0) { return P_INVALID; }
    if (*text == '\0') { return P_FORMAT; }
    int value = 0;
    for (size_t i = 0; text[i] != '\0'; i++) {
        if (text[i] < '0' || text[i] > '9') { return P_FORMAT; }
        int digit = text[i] - '0';
        if (digit > limit || value > (limit - digit) / 10) { return P_LIMIT; }
        value = value * 10 + digit;
    }
    *out = value;
    return P_OK;
}
PStatus p_catalog_status(CatStatus status)
{
    switch (status) {
    case CAT_OK: return P_OK;
    case CAT_DUPLICATE: return P_DUPLICATE;
    case CAT_LIMIT: return P_LIMIT;
    case CAT_NOT_FOUND: return P_MISSING;
    case CAT_MEMORY: return P_MEMORY;
    case CAT_IO: return P_IO;
    default: return P_FORMAT;
    }
}
PStatus p_graph_status(GStatus status)
{
    switch (status) {
    case G_OK: return P_OK;
    case G_DUPLICATE: return P_DUPLICATE;
    case G_RANGE: case G_SPACE: return P_LIMIT;
    case G_MISSING: return P_MISSING;
    case G_CYCLE: return P_CYCLE;
    default: return P_INVALID;
    }
}
PStatus planner_load(FILE *catalog, FILE *relations, Planner *out)
{
    if (catalog == NULL || relations == NULL || out == NULL) { return P_INVALID; }
    Planner candidate;
    planner_init(&candidate);
    PStatus status = p_catalog_status(v3_load(catalog, &candidate.catalog));
    if (status == P_OK) { status = p_relations(relations, &candidate); }
    if (status == P_OK) { swap_owners(out, &candidate); }
    planner_clear(&candidate);
    return status;
}
PStatus planner_load_files(const char *catalog, const char *relations, Planner *out)
{
    if (catalog == NULL || relations == NULL || out == NULL) { return P_INVALID; }
    FILE *records = fopen(catalog, "rb");
    if (records == NULL) { return P_IO; }
    FILE *links = fopen(relations, "rb");
    if (links == NULL) { (void)fclose(records); return P_IO; }
    Planner candidate;
    planner_init(&candidate);
    PStatus status = planner_load(records, links, &candidate);
    int close_records = fclose(records);
    int close_links = fclose(links);
    if (status == P_OK && (close_records != 0 || close_links != 0)) { status = P_IO; }
    if (status == P_OK) { swap_owners(out, &candidate); }
    planner_clear(&candidate);
    return status;
}
PStatus planner_set_minutes(Planner *app, int id, int minutes)
{
    if (app == NULL) { return P_INVALID; }
    if (id < 0 || id > 9999 || minutes < 0 || minutes > 1440) { return P_LIMIT; }
    IRecord record;
    if (indexed_find(&app->catalog, id, &record) != H_OK) { return P_MISSING; }
    return p_catalog_status(v3_hash_status(indexed_set_minutes(&app->catalog, id, minutes)));
}
PStatus planner_export(FILE *out, const Planner *app)
{
    if (out == NULL || app == NULL) { return P_INVALID; }
    return p_catalog_status(v3_save(out, &app->catalog));
}
const char *planner_status_name(PStatus status)
{
    switch (status) {
    case P_OK: return "ok";
    case P_INVALID: return "invalid argument";
    case P_FORMAT: return "bad format";
    case P_DUPLICATE: return "duplicate item";
    case P_LIMIT: return "limit exceeded";
    case P_MISSING: return "missing reference or item";
    case P_CYCLE: return "cycle";
    case P_MEMORY: return "out of memory";
    case P_IO: return "I/O error";
    default: return "unknown error";
    }
}
