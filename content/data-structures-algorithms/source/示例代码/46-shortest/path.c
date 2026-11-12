#include "shortest_internal.h"
void graph_paths_begin(Shortest *paths, size_t n, size_t source)
{
    *paths = (Shortest){0}; paths->n = n; paths->source = source;
    for (size_t i = 0; i < GRAPH_MAX; i++) { paths->parent[i] = GRAPH_MAX; }
    paths->state[source] = PATH_FINITE;
}
const char *path_state_name(PathState state)
{
    switch (state) { case PATH_UNREACHABLE: return "unreachable"; case PATH_FINITE: return "finite"; case PATH_NEGATIVE: return "negative"; default: return "invalid"; }
}
GStatus graph_path(const Shortest *paths, size_t target, GraphPath *out)
{
    if (paths == NULL || out == NULL || target >= paths->n) { return G_INVALID; }
    if (paths->state[target] == PATH_UNREACHABLE) { return G_MISSING; }
    if (paths->state[target] == PATH_NEGATIVE) { return G_NEGATIVE; }
    GraphPath next = {0}; size_t reverse[GRAPH_MAX], n = 0, current = target;
    for (;;) {
        if (current >= paths->n || n == paths->n) { return G_INVALID; }
        reverse[n++] = current;
        if (current == paths->source) { break; }
        current = paths->parent[current];
    }
    next.count = n; next.cost = paths->distance[target];
    for (size_t i = 0; i < n; i++) { next.vertices[i] = reverse[n - 1 - i]; }
    *out = next; return G_OK;
}
