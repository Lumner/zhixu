#include "stage6-test.h"
#include "walk.h"
#include "topological.h"
#include "dsu.h"
#include <string.h>
static unsigned long seed = 20261111UL;
static unsigned int random_word(void) { seed = (seed * 1664525UL + 1013904223UL) % 4294967296UL; return (unsigned int)(seed / 65536UL); }
static void storage(void)
{
    for (int directed = 0; directed <= 1; directed++) {
        Graph graph; REQUIRE(graph_init(&graph, 8, directed) == G_OK, "graph init");
        int has[8][8] = {{0}}, weights[8][8] = {{0}};
        for (size_t step = 0; step < 2500; step++) {
            size_t u = random_word() % 8, v = random_word() % 8; int w = (int)(random_word() % 5) - 2;
            if (random_word() % 2) {
                REQUIRE(graph_add(&graph, u, v, w) == (has[u][v] ? G_DUPLICATE : G_OK), "edge add model");
                if (!has[u][v]) { has[u][v] = 1; weights[u][v] = w; if (!directed) { has[v][u] = 1; weights[v][u] = w; } }
            }
            else {
                REQUIRE(graph_remove(&graph, u, v) == (has[u][v] ? G_OK : G_MISSING), "edge remove model");
                if (has[u][v]) { has[u][v] = 0; weights[u][v] = 0; if (!directed) { has[v][u] = 0; weights[v][u] = 0; } }
            }
            size_t edges = 0, arcs = 0; Adjacency list;
            REQUIRE(graph_adjacency(&graph, &list) == G_OK && list.n == 8, "adjacency conversion");
            int used[64] = {0};
            for (size_t a = 0; a < 8; a++) {
                size_t last = 0, row_count = 0;
                for (size_t i = list.head[a]; i != GRAPH_ARCS; i = list.arcs[i].next) {
                    REQUIRE(i < list.count && !used[i], "arc ownership and no cycle"); used[i] = 1;
                    size_t b = list.arcs[i].to;
                    REQUIRE(b < 8 && has[a][b] && list.arcs[i].weight == weights[a][b] && (row_count == 0 || b > last), "adjacency row order"); last = b; row_count++;
                }
                size_t expected_row = 0;
                for (size_t b = 0; b < 8; b++) {
                    REQUIRE(graph.has[a][b] == has[a][b] && graph.weight[a][b] == weights[a][b], "matrix model");
                    if (has[a][b]) { expected_row++; arcs++; if (directed || a <= b) { edges++; } }
                }
                REQUIRE(row_count == expected_row, "all row arcs present");
            }
            REQUIRE(graph.edges == edges && list.count == arcs, "logical edges versus arcs");
        }
        for (size_t u = 0; u < 8; u++) { for (size_t v = 0; v < 8; v++) { if (!graph.has[u][v]) { REQUIRE(graph_add(&graph, u, v, 0) == G_OK, "complete zero graph"); } } }
        Adjacency list; REQUIRE(graph_adjacency(&graph, &list) == G_OK && list.count == 64 && graph.edges == (directed ? 64U : 36U), "maximum arcs with loops");
        Graph old; memcpy(&old, &graph, sizeof old);
        REQUIRE(graph_add(&graph, 8, 0, 0) == G_INVALID && graph_add(&graph, 0, 0, 1001) == G_RANGE && graph_init(&graph, 9, 0) == G_RANGE && graph_init(&graph, 8, 2) == G_INVALID && memcmp(&old, &graph, sizeof old) == 0, "invalid mutations preserve graph");
    }
    REQUIRE(graph_init(NULL, 0, 0) == G_INVALID && graph_add(NULL, 0, 0, 0) == G_INVALID && graph_remove(NULL, 0, 0) == G_INVALID && graph_adjacency(NULL, NULL) == G_INVALID, "null graph APIs");
}
static void unit_distances(const Graph *g, int hops[8][8])
{
    for (size_t s = 0; s < g->n; s++) {
        for (size_t v = 0; v < g->n; v++) { hops[s][v] = s == v ? 0 : -1; }
        for (size_t pass = 1; pass < g->n; pass++) {
            int previous[8]; memcpy(previous, hops[s], sizeof previous);
            for (size_t u = 0; u < g->n; u++) { for (size_t v = 0; v < g->n; v++) { if (previous[u] >= 0 && g->has[u][v] && (hops[s][v] < 0 || previous[u] + 1 < hops[s][v])) { hops[s][v] = previous[u] + 1; } } }
        }
    }
}
static size_t walks(void)
{
    size_t cases = 0;
    for (unsigned int code = 0; code < 512; code++) {
        Graph g; REQUIRE(graph_init(&g, 3, 1) == G_OK, "walk graph");
        for (size_t u = 0; u < 3; u++) { for (size_t v = 0; v < 3; v++) { if (code & (1U << (3 * u + v))) { REQUIRE(graph_add(&g, u, v, 1) == G_OK, "walk edge"); } } }
        int hops[8][8] = {{0}}; unit_distances(&g, hops);
        for (size_t s = 0; s < 3; s++) {
            Walk bfs, dfs; REQUIRE(graph_bfs(&g, s, &bfs) == G_OK && graph_dfs(&g, s, &dfs) == G_OK, "walk calls");
            for (int kind = 0; kind < 2; kind++) {
                const Walk *w = kind ? &dfs : &bfs; int seen[8] = {0}; size_t reached = 0;
                for (size_t i = 0; i < w->count; i++) {
                    size_t v = w->order[i]; REQUIRE(v < 3 && !seen[v] && hops[s][v] >= 0, "walk unique reachable"); seen[v] = 1;
                    if (v == s) { REQUIRE(w->depth[v] == 0 && w->parent[v] == GRAPH_MAX, "source walk state"); }
                    else { size_t p = w->parent[v]; REQUIRE(p < 3 && g.has[p][v] && w->depth[p] + 1 == w->depth[v], "walk parent depth"); }
                }
                for (size_t v = 0; v < 3; v++) {
                    if (hops[s][v] >= 0) { reached++; REQUIRE(seen[v], "all reachable visited"); if (!kind) { REQUIRE(w->depth[v] == (size_t)hops[s][v], "BFS hop oracle"); } }
                    else { REQUIRE(w->depth[v] == GRAPH_MAX && w->parent[v] == GRAPH_MAX, "unreachable walk sentinel"); }
                }
                REQUIRE(w->count == reached, "walk reach count");
            }
        }
        cases++;
    }
    for (unsigned int code = 0; code < 64; code++) {
        Graph g; REQUIRE(graph_init(&g, 4, 0) == G_OK, "component graph"); size_t bit = 0;
        for (size_t u = 0; u < 4; u++) { for (size_t v = u + 1; v < 4; v++, bit++) { if (code & (1U << bit)) { REQUIRE(graph_add(&g, u, v, 0) == G_OK, "component edge"); } } }
        int hops[8][8] = {{0}}; unit_distances(&g, hops); Components c;
        REQUIRE(graph_components(&g, &c) == G_OK, "component API"); size_t expected = 0;
        for (size_t u = 0; u < 4; u++) {
            int earlier = 0;
            for (size_t v = 0; v < 4; v++) { REQUIRE((c.label[u] == c.label[v]) == (hops[u][v] >= 0), "undirected component equivalence"); if (v < u && hops[u][v] >= 0) { earlier = 1; } }
            if (!earlier) { expected++; }
        }
        REQUIRE(c.count == expected, "component count");
    }
    return cases;
}
static int has_order(const Graph *g, size_t *order, size_t start)
{
    if (start == g->n) {
        size_t rank[8]; for (size_t i = 0; i < g->n; i++) { rank[order[i]] = i; }
        for (size_t u = 0; u < g->n; u++) { for (size_t v = 0; v < g->n; v++) { if (g->has[u][v] && rank[u] >= rank[v]) { return 0; } } } return 1;
    }
    for (size_t i = start; i < g->n; i++) {
        size_t saved = order[i]; order[i] = order[start]; order[start] = saved;
        int found = has_order(g, order, start + 1);
        saved = order[i]; order[i] = order[start]; order[start] = saved;
        if (found) { return 1; }
    }
    return 0;
}
static size_t topology(void)
{
    size_t cases = 0;
    for (unsigned long code = 0; code < 65536UL; code++) {
        Graph g; REQUIRE(graph_init(&g, 4, 1) == G_OK, "topology graph");
        for (size_t u = 0; u < 4; u++) { for (size_t v = 0; v < 4; v++) { if (code & (1UL << (4 * u + v))) { REQUIRE(graph_add(&g, u, v, 1) == G_OK, "topology edge"); } } }
        size_t candidate[] = {0,1,2,3}; int possible = has_order(&g, candidate, 0);
        Topological out = {{0},777}, old; memcpy(&old, &out, sizeof old);
        GStatus status = graph_topological(&g, &out);
        REQUIRE(status == (possible ? G_OK : G_CYCLE), "permutation topology oracle");
        if (!possible) { REQUIRE(memcmp(&out, &old, sizeof out) == 0, "cycle preserves output"); }
        else {
            int seen[8] = {0}; size_t rank[8]; REQUIRE(out.count == 4, "topology count");
            for (size_t i = 0; i < 4; i++) { size_t v = out.vertices[i]; REQUIRE(v < 4 && !seen[v], "topology permutation"); seen[v] = 1; rank[v] = i; }
            for (size_t u = 0; u < 4; u++) { for (size_t v = 0; v < 4; v++) { REQUIRE(!g.has[u][v] || rank[u] < rank[v], "topology edge direction"); } }
        }
        cases++;
    }
    return cases;
}
static void sets(void)
{
    DisjointSet dsu; REQUIRE(dsu_init(&dsu, 8) == G_OK, "DSU init"); size_t label[8]; for (size_t i = 0; i < 8; i++) { label[i] = i; }
    for (size_t step = 0; step < 10000; step++) {
        size_t a = random_word() % 8, b = random_word() % 8;
        if (step % 37 == 0) { REQUIRE(dsu_init(&dsu, 8) == G_OK, "DSU reset"); for (size_t i = 0; i < 8; i++) { label[i] = i; } }
        int expected = label[a] != label[b], merged = -1; size_t old = label[b], next = label[a];
        REQUIRE(dsu_union(&dsu, a, b, &merged) == G_OK && merged == expected, "DSU merge flag");
        if (expected) { for (size_t i = 0; i < 8; i++) { if (label[i] == old) { label[i] = next; } } }
        size_t roots = 0;
        for (size_t i = 0; i < 8; i++) {
            size_t ri; REQUIRE(dsu_find(&dsu, i, &ri) == G_OK && ri < 8 && dsu.parent[ri] == ri, "DSU find root"); size_t size = 0;
            for (size_t j = 0; j < 8; j++) { size_t rj; REQUIRE(dsu_find(&dsu, j, &rj) == G_OK && (ri == rj) == (label[i] == label[j]), "DSU label model"); if (label[i] == label[j]) { size++; } }
            REQUIRE(dsu.size[ri] == size, "DSU root size"); if (dsu.parent[i] == i) { roots++; }
        }
        REQUIRE(dsu.components == roots, "DSU components");
    }
    DisjointSet before; memcpy(&before, &dsu, sizeof before); size_t root = 777; int merged = 777;
    REQUIRE(dsu_find(&dsu, 8, &root) == G_INVALID && root == 777 && dsu_union(&dsu, 0, 8, &merged) == G_INVALID && merged == 777 && dsu_init(&dsu, 9) == G_RANGE && memcmp(&dsu, &before, sizeof dsu) == 0, "DSU invalid preserves");
}
int main(void)
{
    storage(); size_t w = walks(), t = topology(); sets();
    Graph empty; Walk out = {0}; out.count = 777; Components c; Topological topo;
    REQUIRE(graph_init(&empty, 0, 1) == G_OK && graph_dfs(&empty, 0, &out) == G_INVALID && graph_bfs(&empty, 0, &out) == G_INVALID && out.count == 777 && graph_topological(&empty, &topo) == G_OK && topo.count == 0, "empty and invalid traversals");
    REQUIRE(graph_components(&empty, &c) == G_INVALID && graph_topological(NULL, &topo) == G_INVALID, "directed components rejected");
    REQUIRE(graph_init(&empty, 0, 0) == G_OK && graph_components(&empty, &c) == G_OK && c.count == 0 && graph_topological(&empty, &topo) == G_INVALID, "empty undirected components");
    printf("storage_steps=5000 walk_graphs=%zu component_graphs=64 topology_graphs=%zu dsu_steps=10000\n", w, t); return 0;
}
