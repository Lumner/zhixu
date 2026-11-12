#include "planner_internal.h"
#include <string.h>
typedef struct { int from, to, weight; } PendingEdge;
typedef struct {
    int record_ids[RECORD_LIMIT], class_ids[RECORD_LIMIT];
    size_t memberships, dependencies, routes;
    PendingEdge dependency[GRAPH_ARCS], route[GRAPH_MAX * (GRAPH_MAX + 1) / 2];
} Pending;
size_t p_category(const Planner *app, int id)
{
    for (size_t i = 0; i < app->category_count; i++) {
        if (app->categories[i].id == id) { return i; }
    }
    return P_CLASSES;
}
size_t p_study(const Planner *app, int id)
{
    for (size_t i = 0; i < app->study_count; i++) { if (app->study_ids[i] == id) { return i; } }
    return GRAPH_MAX;
}
size_t p_place(const Planner *app, int id)
{
    for (size_t i = 0; i < app->place_count; i++) { if (app->places[i].id == id) { return i; } }
    return GRAPH_MAX;
}
static PStatus line_read(FILE *in, char *line, int *end)
{
    size_t n = 0;
    int ch, too_long = 0;
    *end = 0;
    while ((ch = fgetc(in)) != EOF && ch != '\n') {
        if (n + 1 < P_LINE) { line[n++] = (char)ch; }
        else { too_long = 1; }
    }
    if (ferror(in)) { return P_IO; }
    if (ch == EOF && n == 0 && !too_long) { *end = 1; return P_OK; }
    if (too_long) { return P_LIMIT; }
    if (n != 0 && line[n - 1] == '\r' && ch == '\n') { n--; }
    for (size_t i = 0; i < n; i++) {
        unsigned char byte = (unsigned char)line[i];
        if (byte < 32 || byte == 127) { return P_FORMAT; }
    }
    line[n] = '\0';
    return P_OK;
}
static PStatus fields(char *line, char **parts, size_t *count)
{
    size_t n = 1;
    parts[0] = line;
    for (size_t i = 0; line[i] != '\0'; i++) {
        if (line[i] == '|') {
            if (n == 4) { return P_FORMAT; }
            line[i] = '\0'; parts[n++] = line + i + 1;
        }
    }
    *count = n;
    return P_OK;
}
static PStatus label_copy(char *out, const char *text)
{
    size_t n = strlen(text);
    if (n == 0) { return P_FORMAT; }
    if (n >= P_LABEL) { return P_LIMIT; }
    memcpy(out, text, n + 1);
    return P_OK;
}
static PStatus append(Planner *app, Pending *pending, int type, char **parts)
{
    int first, second = 0, third = 0;
    PStatus status = planner_number(parts[1], 9999, &first);
    if (status != P_OK) { return status; }
    if (type == 0) {
        if (strcmp(parts[2], "-1") == 0) { second = -1; }
        else { status = planner_number(parts[2], 9999, &second); }
    } else if (type == 1 || type == 3 || type == 5) {
        status = planner_number(parts[2], 9999, &second);
    }
    if (status != P_OK) { return status; }
    if (type == 5) {
        status = planner_number(parts[3], GRAPH_WEIGHT_MAX, &third);
        if (status != P_OK) { return status; }
    }
    if (type == 0) {
        if (p_category(app, first) != P_CLASSES) { return P_DUPLICATE; }
        if (app->category_count == P_CLASSES) { return P_LIMIT; }
        PCategory *row = &app->categories[app->category_count];
        status = label_copy(row->label, parts[3]);
        if (status != P_OK) { return status; }
        row->id = first; row->parent_id = second; app->category_count++;
    } else if (type == 1) {
        if (pending->memberships == RECORD_LIMIT) { return P_LIMIT; }
        size_t i = pending->memberships++;
        pending->record_ids[i] = first; pending->class_ids[i] = second;
    } else if (type == 2) {
        if (p_study(app, first) != GRAPH_MAX) { return P_DUPLICATE; }
        if (app->study_count == GRAPH_MAX) { return P_LIMIT; }
        app->study_ids[app->study_count++] = first;
    } else if (type == 3) {
        if (pending->dependencies == GRAPH_ARCS) { return P_LIMIT; }
        pending->dependency[pending->dependencies++] = (PendingEdge){first,second,1};
    } else if (type == 4) {
        if (p_place(app, first) != GRAPH_MAX) { return P_DUPLICATE; }
        if (app->place_count == GRAPH_MAX) { return P_LIMIT; }
        PPlace *row = &app->places[app->place_count];
        status = label_copy(row->label, parts[2]);
        if (status != P_OK) { return status; }
        row->id = first; app->place_count++;
    } else {
        if (pending->routes == GRAPH_MAX * (GRAPH_MAX + 1) / 2) { return P_LIMIT; }
        pending->route[pending->routes++] = (PendingEdge){first,second,third};
    }
    return P_OK;
}
static PStatus resolve(Planner *app, const Pending *pending)
{
    size_t roots = 0;
    for (size_t i = 0; i < app->category_count; i++) {
        if (app->categories[i].parent_id == -1) { roots++; }
        size_t current = i, steps = 0;
        while (app->categories[current].parent_id != -1) {
            current = p_category(app, app->categories[current].parent_id);
            if (current == P_CLASSES) { return P_MISSING; }
            if (++steps >= app->category_count) { return P_CYCLE; }
        }
    }
    if (app->category_count != 0 && roots != 1) { return P_INVALID; }
    for (size_t i = 0; i < pending->memberships; i++) {
        int position;
        if (open_get(&app->catalog.index, pending->record_ids[i], &position) != H_OK) { return P_MISSING; }
        size_t category = p_category(app, pending->class_ids[i]);
        if (category == P_CLASSES) { return P_MISSING; }
        if (app->membership[position] != P_CLASSES) { return P_DUPLICATE; }
        app->membership[position] = category;
    }
    for (size_t i = 0; i < app->catalog.count; i++) {
        if (app->membership[i] == P_CLASSES) { return P_MISSING; }
    }
    for (size_t i = 0; i < app->study_count; i++) {
        IRecord row;
        if (indexed_find(&app->catalog, app->study_ids[i], &row) != H_OK) { return P_MISSING; }
    }
    (void)graph_init(&app->study, app->study_count, 1);
    (void)graph_init(&app->roads, app->place_count, 0);
    for (size_t i = 0; i < pending->dependencies; i++) {
        PendingEdge edge = pending->dependency[i];
        size_t from = p_study(app, edge.from), to = p_study(app, edge.to);
        if (from == GRAPH_MAX || to == GRAPH_MAX) { return P_MISSING; }
        PStatus status = p_graph_status(graph_add(&app->study, from, to, edge.weight));
        if (status != P_OK) { return status; }
    }
    Topological order;
    PStatus status = p_graph_status(graph_topological(&app->study, &order));
    if (status != P_OK) { return status; }
    for (size_t i = 0; i < pending->routes; i++) {
        PendingEdge edge = pending->route[i];
        size_t from = p_place(app, edge.from), to = p_place(app, edge.to);
        if (from == GRAPH_MAX || to == GRAPH_MAX) { return P_MISSING; }
        status = p_graph_status(graph_add(&app->roads, from, to, edge.weight));
        if (status != P_OK) { return status; }
    }
    return P_OK;
}
PStatus p_relations(FILE *in, Planner *candidate)
{
    Pending pending = {0};
    char line[P_LINE]; int end, phase = -1;
    PStatus status = line_read(in, line, &end);
    if (status != P_OK) { return status; }
    if (end || strcmp(line, "DSA-RELATIONS-1") != 0) { return P_FORMAT; }
    for (;;) {
        status = line_read(in, line, &end);
        if (status != P_OK || end) { break; }
        char *parts[4]; size_t count;
        status = fields(line, parts, &count);
        if (status != P_OK) { return status; }
        if (strlen(parts[0]) != 1) { return P_FORMAT; }
        static const char tags[] = "CMSDPR";
        const char *tag = strchr(tags, parts[0][0]);
        if (tag == NULL) { return P_FORMAT; }
        int type = (int)(tag - tags);
        static const size_t expected[] = {4,3,2,3,3,4};
        if (type < phase || count != expected[type]) { return P_FORMAT; }
        phase = type;
        status = append(candidate, &pending, type, parts);
        if (status != P_OK) { return status; }
    }
    return status == P_OK ? resolve(candidate, &pending) : status;
}
