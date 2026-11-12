#include "topological.h"
GStatus graph_topological(const Graph *graph, Topological *out)
{
    if (graph == NULL || out == NULL || !graph->directed) { return G_INVALID; }
    size_t indegree[GRAPH_MAX] = {0}, queue[GRAPH_MAX], head = 0, tail = 0; Topological next = {0};
    for (size_t u = 0; u < graph->n; u++) { for (size_t v = 0; v < graph->n; v++) { if (graph->has[u][v]) { indegree[v]++; } } }
    for (size_t u = 0; u < graph->n; u++) { if (indegree[u] == 0) { queue[tail++] = u; } }
    while (head < tail) {
        size_t u = queue[head++]; next.vertices[next.count++] = u;
        for (size_t v = 0; v < graph->n; v++) { if (graph->has[u][v] && --indegree[v] == 0) { queue[tail++] = v; } }
    }
    if (next.count != graph->n) { return G_CYCLE; }
    *out = next; return G_OK;
}
