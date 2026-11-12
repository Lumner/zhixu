#include "walk.h"
static void prepare(Walk *walk, size_t n, size_t source)
{
    *walk = (Walk){0}; walk->n = n; walk->source = source;
    for (size_t i = 0; i < GRAPH_MAX; i++) { walk->depth[i] = walk->parent[i] = GRAPH_MAX; }
    walk->depth[source] = 0;
}
static void visit(const Graph *graph, size_t u, Walk *walk)
{
    walk->order[walk->count++] = u;
    for (size_t v = 0; v < graph->n; v++) {
        if (graph->has[u][v] && walk->depth[v] == GRAPH_MAX) {
            walk->parent[v] = u; walk->depth[v] = walk->depth[u] + 1; visit(graph, v, walk);
        }
    }
}
GStatus graph_dfs(const Graph *graph, size_t source, Walk *out)
{
    if (graph == NULL || out == NULL || source >= graph->n) { return G_INVALID; }
    Walk next; prepare(&next, graph->n, source); visit(graph, source, &next); *out = next; return G_OK;
}
GStatus graph_bfs(const Graph *graph, size_t source, Walk *out)
{
    if (graph == NULL || out == NULL || source >= graph->n) { return G_INVALID; }
    Walk next; prepare(&next, graph->n, source); size_t queue[GRAPH_MAX], head = 0, tail = 0;
    queue[tail++] = source;
    while (head < tail) {
        size_t u = queue[head++]; next.order[next.count++] = u;
        for (size_t v = 0; v < graph->n; v++) {
            if (graph->has[u][v] && next.depth[v] == GRAPH_MAX) {
                next.depth[v] = next.depth[u] + 1; next.parent[v] = u; queue[tail++] = v;
            }
        }
    }
    *out = next; return G_OK;
}
GStatus graph_components(const Graph *graph, Components *out)
{
    if (graph == NULL || out == NULL || graph->directed) { return G_INVALID; }
    Components next = {0}; next.n = graph->n;
    for (size_t i = 0; i < GRAPH_MAX; i++) { next.label[i] = GRAPH_MAX; }
    for (size_t u = 0; u < graph->n; u++) {
        if (next.label[u] != GRAPH_MAX) { continue; }
        Walk walk; (void)graph_bfs(graph, u, &walk);
        for (size_t i = 0; i < walk.count; i++) { next.label[walk.order[i]] = next.count; }
        next.count++;
    }
    *out = next; return G_OK;
}
