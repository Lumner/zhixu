#include "shortest_internal.h"
GStatus graph_floyd(const Graph *graph, AllPairs *out)
{
    if (graph == NULL || out == NULL) { return G_INVALID; }
    AllPairs next = {0}; next.n = graph->n;
    for (size_t u = 0; u < graph->n; u++) {
        next.state[u][u] = PATH_FINITE;
        for (size_t v = 0; v < graph->n; v++) {
            if (graph->has[u][v] && (u != v || graph->weight[u][v] < 0)) { next.state[u][v] = PATH_FINITE; next.distance[u][v] = graph->weight[u][v]; }
        }
    }
    for (size_t k = 0; k < graph->n; k++) {
        AllPairs previous = next;
        for (size_t u = 0; u < graph->n; u++) {
            for (size_t v = 0; v < graph->n; v++) {
                if (previous.state[u][k] != PATH_FINITE || previous.state[k][v] != PATH_FINITE) { continue; }
                long cost; GStatus status = graph_cost_sum(previous.distance[u][k], previous.distance[k][v], &cost);
                if (status != G_OK) { return status; }
                if (next.state[u][v] == PATH_UNREACHABLE || cost < next.distance[u][v]) { next.state[u][v] = PATH_FINITE; next.distance[u][v] = cost; }
            }
        }
    }
    AllPairs finite = next;
    for (size_t u = 0; u < graph->n; u++) {
        for (size_t v = 0; v < graph->n; v++) {
            for (size_t k = 0; k < graph->n; k++) {
                if (finite.state[u][k] == PATH_FINITE && finite.state[k][v] == PATH_FINITE && finite.distance[k][k] < 0) { next.state[u][v] = PATH_NEGATIVE; }
            }
        }
    }
    *out = next; return G_OK;
}
