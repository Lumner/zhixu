#include "graph_internal.h"
#include <limits.h>
GStatus graph_init(Graph *graph, size_t n, int directed)
{
    if (graph == NULL || (directed != 0 && directed != 1)) { return G_INVALID; }
    if (n > GRAPH_MAX) { return G_RANGE; }
    Graph next = {0}; next.n = n; next.directed = directed; *graph = next; return G_OK;
}
GStatus graph_add(Graph *graph, size_t from, size_t to, int weight)
{
    if (graph == NULL || from >= graph->n || to >= graph->n) { return G_INVALID; }
    if (weight < -GRAPH_WEIGHT_MAX || weight > GRAPH_WEIGHT_MAX) { return G_RANGE; }
    if (graph->has[from][to]) { return G_DUPLICATE; }
    graph->has[from][to] = 1; graph->weight[from][to] = weight;
    if (!graph->directed) { graph->has[to][from] = 1; graph->weight[to][from] = weight; }
    graph->edges++; return G_OK;
}
GStatus graph_remove(Graph *graph, size_t from, size_t to)
{
    if (graph == NULL || from >= graph->n || to >= graph->n) { return G_INVALID; }
    if (!graph->has[from][to]) { return G_MISSING; }
    graph->has[from][to] = 0; graph->weight[from][to] = 0;
    if (!graph->directed) { graph->has[to][from] = 0; graph->weight[to][from] = 0; }
    graph->edges--; return G_OK;
}
GStatus graph_adjacency(const Graph *graph, Adjacency *out)
{
    if (graph == NULL || out == NULL) { return G_INVALID; }
    Adjacency next = {0}; next.n = graph->n;
    for (size_t u = 0; u < GRAPH_MAX; u++) { next.head[u] = GRAPH_ARCS; }
    for (size_t u = 0; u < graph->n; u++) {
        for (size_t end = graph->n; end > 0; end--) {
            size_t v = end - 1;
            if (graph->has[u][v]) {
                size_t index = next.count++;
                next.arcs[index] = (Arc){v,graph->weight[u][v],next.head[u]}; next.head[u] = index;
            }
        }
    }
    *out = next; return G_OK;
}
GStatus graph_cost_sum(long left, long right, long *out)
{
    if (out == NULL) { return G_INVALID; }
    if ((right > 0 && left > LONG_MAX - right) || (right < 0 && left < LONG_MIN - right)) { return G_RANGE; }
    *out = left + right; return G_OK;
}
