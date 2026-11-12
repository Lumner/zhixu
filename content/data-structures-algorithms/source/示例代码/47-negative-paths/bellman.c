#include "shortest_internal.h"
GStatus graph_bellman(const Graph *graph, size_t source, Shortest *out)
{
    if (graph == NULL || out == NULL || source >= graph->n) { return G_INVALID; }
    Shortest next; graph_paths_begin(&next, graph->n, source);
    for (size_t pass = 1; pass < graph->n; pass++) {
        Shortest previous = next; int changed = 0;
        for (size_t u = 0; u < graph->n; u++) {
            if (previous.state[u] != PATH_FINITE) { continue; }
            for (size_t v = 0; v < graph->n; v++) {
                if (!graph->has[u][v]) { continue; }
                long cost; GStatus status = graph_cost_sum(previous.distance[u], graph->weight[u][v], &cost);
                if (status != G_OK) { return status; }
                if (next.state[v] == PATH_UNREACHABLE || cost < next.distance[v]) {
                    next.state[v] = PATH_FINITE; next.distance[v] = cost; next.parent[v] = u; changed = 1;
                }
            }
        }
        if (!changed) { break; }
    }
    int affected[GRAPH_MAX] = {0};
    for (size_t u = 0; u < graph->n; u++) {
        if (next.state[u] != PATH_FINITE) { continue; }
        for (size_t v = 0; v < graph->n; v++) {
            if (!graph->has[u][v]) { continue; }
            long cost; GStatus status = graph_cost_sum(next.distance[u], graph->weight[u][v], &cost);
            if (status != G_OK) { return status; }
            if (next.state[v] == PATH_UNREACHABLE || cost < next.distance[v]) { affected[v] = 1; }
        }
    }
    for (size_t pass = 0; pass < graph->n; pass++) {
        for (size_t u = 0; u < graph->n; u++) { if (affected[u]) { for (size_t v = 0; v < graph->n; v++) { if (graph->has[u][v]) { affected[v] = 1; } } } }
    }
    for (size_t v = 0; v < graph->n; v++) { if (affected[v]) { next.state[v] = PATH_NEGATIVE; next.parent[v] = GRAPH_MAX; } }
    *out = next; return G_OK;
}
