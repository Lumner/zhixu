#include "spanning.h"
#include "dsu.h"
#include "graph_internal.h"
static int compare(Edge a, Edge b)
{
    if (a.weight != b.weight) { return a.weight < b.weight ? -1 : 1; }
    if (a.from != b.from) { return a.from < b.from ? -1 : 1; }
    return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
}
static void swap(Edge *a, Edge *b) { Edge saved = *a; *a = *b; *b = saved; }
static void edge_down(Edge *edges, size_t root, size_t n)
{
    while (root < n / 2) {
        size_t child = root * 2 + 1;
        if (child + 1 < n && compare(edges[child + 1], edges[child]) > 0) { child++; }
        if (compare(edges[root], edges[child]) >= 0) { break; }
        swap(&edges[root], &edges[child]); root = child;
    }
}
static void edge_sort(Edge *edges, size_t n)
{
    for (size_t i = n / 2; i > 0; i--) { edge_down(edges, i - 1, n); }
    for (size_t end = n; end > 1; end--) { swap(&edges[0], &edges[end - 1]); edge_down(edges, 0, end - 1); }
}
GStatus graph_kruskal(const Graph *graph, Forest *out)
{
    if (graph == NULL || out == NULL || graph->directed) { return G_INVALID; }
    Edge edges[GRAPH_ARCS]; size_t n = 0;
    for (size_t u = 0; u < graph->n; u++) { for (size_t v = u + 1; v < graph->n; v++) { if (graph->has[u][v]) { edges[n++] = (Edge){u,v,graph->weight[u][v]}; } } }
    edge_sort(edges, n); DisjointSet sets; (void)dsu_init(&sets, graph->n);
    Forest next = {0}; next.vertices = graph->n;
    for (size_t i = 0; i < n; i++) {
        int merged; (void)dsu_union(&sets, edges[i].from, edges[i].to, &merged);
        if (merged) {
            GStatus status = graph_cost_sum(next.total, edges[i].weight, &next.total);
            if (status != G_OK) { return status; }
            next.edges[next.count++] = edges[i];
        }
    }
    next.components = sets.components; *out = next; return G_OK;
}
GStatus graph_prim(const Graph *graph, Forest *out)
{
    if (graph == NULL || out == NULL || graph->directed) { return G_INVALID; }
    Forest next = {0}; next.vertices = graph->n;
    int used[GRAPH_MAX] = {0}, known[GRAPH_MAX] = {0}, best[GRAPH_MAX] = {0}; size_t parent[GRAPH_MAX];
    for (size_t i = 0; i < GRAPH_MAX; i++) { parent[i] = GRAPH_MAX; }
    for (size_t root = 0; root < graph->n; root++) {
        if (used[root]) { continue; }
        next.components++; known[root] = 1; best[root] = 0;
        for (;;) {
            size_t u = GRAPH_MAX;
            for (size_t v = 0; v < graph->n; v++) { if (!used[v] && known[v] && (u == GRAPH_MAX || best[v] < best[u])) { u = v; } }
            if (u == GRAPH_MAX) { break; }
            used[u] = 1;
            if (parent[u] != GRAPH_MAX) {
                size_t a = parent[u] < u ? parent[u] : u, b = parent[u] < u ? u : parent[u];
                next.edges[next.count++] = (Edge){a,b,best[u]};
                GStatus status = graph_cost_sum(next.total, best[u], &next.total); if (status != G_OK) { return status; }
            }
            for (size_t v = 0; v < graph->n; v++) {
                if (!used[v] && graph->has[u][v] && (!known[v] || graph->weight[u][v] < best[v] || (graph->weight[u][v] == best[v] && u < parent[v]))) {
                    known[v] = 1; best[v] = graph->weight[u][v]; parent[v] = u;
                }
            }
        }
    }
    *out = next; return G_OK;
}
