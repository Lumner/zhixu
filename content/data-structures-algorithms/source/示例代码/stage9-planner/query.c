#include "planner_internal.h"
#include "../27-matching/matching.h"
#include "../41-heap/heap.h"
#include <string.h>
PStatus planner_find(const Planner *app, int id, IRecord *out)
{
    if (app == NULL || out == NULL) { return P_INVALID; }
    if (id < 0 || id > 9999) { return P_LIMIT; }
    return p_catalog_status(v3_hash_status(indexed_find(&app->catalog, id, out)));
}
PStatus planner_view(const Planner *app, PRecords *out)
{
    if (app == NULL || out == NULL) { return P_INVALID; }
    PRecords next = {0};
    SortStatus status = catalog_view(&app->catalog, next.records, RECORD_LIMIT, &next.stats);
    if (status != S_OK) { return status == S_MEMORY ? P_MEMORY : P_INVALID; }
    next.count = app->catalog.count;
    *out = next;
    return P_OK;
}
PStatus planner_title(const Planner *app, const char *pattern, PRecords *out)
{
    if (app == NULL || pattern == NULL || out == NULL) { return P_INVALID; }
    size_t length = strlen(pattern);
    if (length > MATCH_PATTERN_MAX) { return P_LIMIT; }
    PRecords next = {0};
    for (size_t i = 0; i < app->catalog.count; i++) {
        const IRecord *row = &app->catalog.records[i];
        Match match;
        if (kmp_match(row->title, strlen(row->title), pattern, length, &match) != M_OK) { return P_INVALID; }
        if (match.found) { next.records[next.count++] = *row; }
    }
    *out = next;
    return P_OK;
}
static void category_visit(const Planner *app, size_t position, size_t depth, PCategoryView *out)
{
    out->positions[out->count] = position;
    out->depths[out->count++] = depth;
    for (size_t i = 0; i < app->category_count; i++) {
        if (app->categories[i].parent_id == app->categories[position].id) {
            category_visit(app, i, depth + 1, out);
        }
    }
}
PStatus planner_categories(const Planner *app, PCategoryView *out)
{
    if (app == NULL || out == NULL) { return P_INVALID; }
    PCategoryView next = {0};
    for (size_t i = 0; i < app->category_count; i++) {
        if (app->categories[i].parent_id == -1) { category_visit(app, i, 0, &next); }
    }
    *out = next;
    return P_OK;
}
PStatus planner_order(const Planner *app, PIds *out)
{
    if (app == NULL || out == NULL) { return P_INVALID; }
    Topological order;
    PStatus status = p_graph_status(graph_topological(&app->study, &order));
    if (status != P_OK) { return status; }
    PIds next = {0};
    next.count = order.count;
    for (size_t i = 0; i < order.count; i++) { next.ids[i] = app->study_ids[order.vertices[i]]; }
    *out = next;
    return P_OK;
}
PStatus planner_ready(const Planner *app, const int *done, size_t n, PIds *out)
{
    if (app == NULL || out == NULL || (n != 0 && done == NULL)) { return P_INVALID; }
    if (n > GRAPH_MAX) { return P_LIMIT; }
    unsigned char finished[GRAPH_MAX] = {0};
    for (size_t i = 0; i < n; i++) {
        size_t position = p_study(app, done[i]);
        if (position == GRAPH_MAX) { return P_MISSING; }
        if (finished[position]) { return P_DUPLICATE; }
        finished[position] = 1;
    }
    for (size_t u = 0; u < app->study_count; u++) {
        for (size_t v = 0; v < app->study_count; v++) {
            if (app->study.has[u][v] && finished[v] && !finished[u]) { return P_INVALID; }
        }
    }
    MinHeap queue;
    heap_init(&queue);
    for (size_t v = 0; v < app->study_count; v++) {
        int blocked = finished[v];
        for (size_t u = 0; u < app->study_count; u++) {
            if (app->study.has[u][v] && !finished[u]) { blocked = 1; }
        }
        if (!blocked) {
            IRecord row;
            if (planner_find(app, app->study_ids[v], &row) != P_OK) { return P_MISSING; }
            if (heap_push(&queue, (Job){row.minutes,row.id}) != T_OK) { return P_INVALID; }
        }
    }
    PIds next = {0};
    while (queue.count != 0) {
        Job job;
        if (heap_pop(&queue, &job) != T_OK) { return P_INVALID; }
        next.ids[next.count++] = job.id;
    }
    *out = next;
    return P_OK;
}
PStatus planner_route(const Planner *app, int source, int target, PRoute *out)
{
    if (app == NULL || out == NULL) { return P_INVALID; }
    size_t from = p_place(app, source), to = p_place(app, target);
    if (from == GRAPH_MAX || to == GRAPH_MAX) { return P_MISSING; }
    Shortest paths;
    PStatus status = p_graph_status(graph_dijkstra(&app->roads, from, &paths));
    if (status != P_OK) { return status; }
    PRoute next = {0};
    if (paths.state[to] == PATH_FINITE) {
        GraphPath path;
        status = p_graph_status(graph_path(&paths, to, &path));
        if (status != P_OK) { return status; }
        next.reachable = 1; next.cost = path.cost; next.count = path.count;
        for (size_t i = 0; i < path.count; i++) { next.ids[i] = app->places[path.vertices[i]].id; }
    }
    *out = next;
    return P_OK;
}
