#include "stage6-test.h"
#include "spanning.h"
#include <limits.h>
#include <string.h>
static int relabel(size_t *labels, size_t n, size_t u, size_t v)
{
    if (labels[u] == labels[v]) { return 0; }
    size_t old = labels[v], next = labels[u];
    for (size_t i = 0; i < n; i++) { if (labels[i] == old) { labels[i] = next; } } return 1;
}
static long brute_forest(const Graph *g, const Edge *edges, size_t e, size_t *components)
{
    size_t connected[8]; for (size_t i = 0; i < g->n; i++) { connected[i] = i; }
    *components = g->n;
    for (size_t i = 0; i < e; i++) { if (relabel(connected, g->n, edges[i].from, edges[i].to)) { (*components)--; } }
    long best = LONG_MAX;
    for (unsigned int mask = 0; mask < (1U << e); mask++) {
        size_t labels[8], count = 0; for (size_t i = 0; i < g->n; i++) { labels[i] = i; }
        int valid = 1; long cost = 0;
        for (size_t i = 0; i < e; i++) {
            if (!(mask & (1U << i))) { continue; }
            if (!relabel(labels, g->n, edges[i].from, edges[i].to)) { valid = 0; break; }
            cost += edges[i].weight; count++;
        }
        if (!valid || count != g->n - *components) { continue; }
        for (size_t u = 0; u < g->n; u++) { for (size_t v = 0; v < g->n; v++) { if ((labels[u] == labels[v]) != (connected[u] == connected[v])) { valid = 0; } } }
        if (valid && cost < best) { best = cost; }
    }
    REQUIRE(best != LONG_MAX, "brute forest exists"); return best;
}
static void inspect(const Graph *g, const Forest *forest, long expected, size_t components)
{
    REQUIRE(forest->vertices == g->n && forest->components == components && forest->count == g->n - components && forest->total == expected, "brute minimum forest cost");
    size_t labels[8]; for (size_t i = 0; i < g->n; i++) { labels[i] = i; } long sum = 0;
    for (size_t i = 0; i < forest->count; i++) {
        Edge edge = forest->edges[i]; REQUIRE(edge.from < edge.to && edge.to < g->n && g->has[edge.from][edge.to] && edge.weight == g->weight[edge.from][edge.to], "selected edge exists and not loop");
        REQUIRE(relabel(labels, g->n, edge.from, edge.to), "selected forest acyclic"); sum += edge.weight;
    }
    REQUIRE(sum == forest->total, "forest edge sum");
    for (size_t u = 0; u < g->n; u++) { for (size_t v = 0; v < g->n; v++) { REQUIRE(!g->has[u][v] || labels[u] == labels[v], "forest spans each graph component"); } }
}
static size_t forest_graphs(void)
{
    const int weights[] = {0,-2,0,3}; size_t cases = 0;
    for (unsigned int code = 0; code < 4096; code++) {
        Graph g; REQUIRE(graph_init(&g, 4, 0) == G_OK, "forest graph"); unsigned int value = code; Edge edges[6]; size_t e = 0;
        for (size_t u = 0; u < 4; u++) {
            REQUIRE(graph_add(&g, u, u, -1000) == G_OK, "MST self loops ignored");
            for (size_t v = u + 1; v < 4; v++) { size_t choice = value % 4; value /= 4; if (choice) { REQUIRE(graph_add(&g, u, v, weights[choice]) == G_OK, "forest edge"); edges[e++] = (Edge){u,v,weights[choice]}; } }
        }
        size_t components; long best = brute_forest(&g, edges, e, &components); Forest a, b;
        REQUIRE(graph_kruskal(&g, &a) == G_OK && graph_prim(&g, &b) == G_OK, "two forest algorithms"); inspect(&g, &a, best, components); inspect(&g, &b, best, components); cases++;
    }
    return cases;
}
int main(void)
{
    size_t graphs = forest_graphs(); Graph g; Forest a, b;
    REQUIRE(graph_init(&g, 8, 0) == G_OK, "maximum forest graph");
    for (size_t u = 0; u < 8; u++) { for (size_t v = u; v < 8; v++) { REQUIRE(graph_add(&g, u, v, -1000) == G_OK, "maximum forest edges"); } }
    REQUIRE(graph_kruskal(&g, &a) == G_OK && graph_prim(&g, &b) == G_OK && a.total == -7000 && b.total == -7000 && a.count == 7 && b.count == 7, "maximum negative forest total");
    REQUIRE(graph_init(&g, 8, 0) == G_OK && graph_kruskal(&g, &a) == G_OK && graph_prim(&g, &b) == G_OK && a.components == 8 && b.components == 8 && a.total == 0 && b.total == 0, "all isolated vertices");
    REQUIRE(graph_init(&g, 0, 0) == G_OK && graph_kruskal(&g, &a) == G_OK && graph_prim(&g, &b) == G_OK && a.components == 0 && b.count == 0, "empty forest");
    Forest old = {0}; old.count = 777; a = old; b = old;
    REQUIRE(graph_init(&g, 2, 1) == G_OK && graph_kruskal(&g, &a) == G_INVALID && graph_prim(&g, &b) == G_INVALID && memcmp(&a, &old, sizeof a) == 0 && memcmp(&b, &old, sizeof b) == 0, "directed MST rejected preserves");
    REQUIRE(graph_kruskal(NULL, &a) == G_INVALID && graph_prim(&g, NULL) == G_INVALID, "null forests");
    printf("weighted_undirected_graphs=%zu exhaustive_edge_subsets=1 forest_boundaries=1\n", graphs); return 0;
}
