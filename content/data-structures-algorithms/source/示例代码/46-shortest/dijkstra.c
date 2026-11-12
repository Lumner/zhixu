#include "shortest_internal.h"
GStatus graph_dijkstra(const Graph *graph, size_t source, Shortest *out)
{
    if (graph == NULL || out == NULL || source >= graph->n) { return G_INVALID; }
    for (size_t u = 0; u < graph->n; u++) {
        for (size_t v = 0; v < graph->n; v++) { if (graph->has[u][v] && graph->weight[u][v] < 0) { return G_NEGATIVE; } }
    }
    Shortest next; graph_paths_begin(&next, graph->n, source); int done[GRAPH_MAX] = {0};
    for (size_t step = 0; step < graph->n; step++) {
        size_t u = GRAPH_MAX;
        for (size_t v = 0; v < graph->n; v++) {
            if (!done[v] && next.state[v] == PATH_FINITE && (u == GRAPH_MAX || next.distance[v] < next.distance[u])) { u = v; }
        }
        if (u == GRAPH_MAX) { break; }
        done[u] = 1;
        for (size_t v = 0; v < graph->n; v++) {
            if (!graph->has[u][v] || done[v]) { continue; }
            long cost; GStatus status = graph_cost_sum(next.distance[u], graph->weight[u][v], &cost);
            if (status != G_OK) { return status; }
            if (next.state[v] == PATH_UNREACHABLE || cost < next.distance[v]) {
                next.state[v] = PATH_FINITE; next.distance[v] = cost; next.parent[v] = u;
            }
        }
    }
    *out = next; return G_OK;
}
