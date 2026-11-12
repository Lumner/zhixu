#include "stage6-test.h"
#include "shortest_internal.h"
#include <limits.h>
#include <string.h>
typedef struct { int reach[8][8]; long best[8][8]; int negative_cycle[8]; } Oracle;
static void simple_paths(const Graph *g, size_t s, size_t u, unsigned int visited, long cost, Oracle *out)
{
    if (!out->reach[s][u] || cost < out->best[s][u]) { out->best[s][u] = cost; }
    out->reach[s][u] = 1;
    for (size_t v = 0; v < g->n; v++) {
        if (g->has[u][v] && !(visited & (1U << v))) { simple_paths(g, s, v, visited | (1U << v), cost + g->weight[u][v], out); }
    }
}
static void simple_cycles(const Graph *g, size_t s, size_t u, unsigned int visited, long cost, Oracle *out)
{
    for (size_t v = 0; v < g->n; v++) {
        if (!g->has[u][v]) { continue; }
        long next = cost + g->weight[u][v];
        if (v == s) { if (next < 0) { out->negative_cycle[s] = 1; } }
        else if (!(visited & (1U << v))) { simple_cycles(g, s, v, visited | (1U << v), next, out); }
    }
}
static Oracle reference(const Graph *g)
{
    Oracle out = {0};
    for (size_t s = 0; s < g->n; s++) { simple_paths(g, s, s, 1U << s, 0, &out); simple_cycles(g, s, s, 1U << s, 0, &out); }
    return out;
}
static PathState expected_state(const Oracle *o, size_t n, size_t s, size_t t)
{
    for (size_t k = 0; k < n; k++) { if (o->negative_cycle[k] && o->reach[s][k] && o->reach[k][t]) { return PATH_NEGATIVE; } }
    return o->reach[s][t] ? PATH_FINITE : PATH_UNREACHABLE;
}
static void check_paths(const Graph *g, const Oracle *oracle, size_t s, const Shortest *paths)
{
    REQUIRE(paths->n == g->n && paths->source == s, "shortest metadata");
    for (size_t t = 0; t < g->n; t++) {
        PathState state = expected_state(oracle, g->n, s, t);
        REQUIRE(paths->state[t] == state, "simple paths and cycles classification");
        GraphPath path = {{0},777,888}, before; memcpy(&before, &path, sizeof before);
        GStatus status = graph_path(paths, t, &path);
        if (state != PATH_FINITE) {
            REQUIRE(status == (state == PATH_NEGATIVE ? G_NEGATIVE : G_MISSING) && memcmp(&path, &before, sizeof path) == 0, "nonfinite path preserves output");
            continue;
        }
        REQUIRE(paths->distance[t] == oracle->best[s][t] && status == G_OK && path.cost == oracle->best[s][t], "simple path distance oracle");
        REQUIRE(path.count >= 1 && path.count <= g->n && path.vertices[0] == s && path.vertices[path.count - 1] == t, "path endpoints");
        int seen[8] = {0}; long sum = 0;
        for (size_t i = 0; i < path.count; i++) {
            size_t v = path.vertices[i]; REQUIRE(v < g->n && !seen[v], "finite path simple"); seen[v] = 1;
            if (i) { size_t u = path.vertices[i - 1]; REQUIRE(g->has[u][v], "path uses existing edge"); sum += g->weight[u][v]; }
        }
        REQUIRE(sum == path.cost, "path edge sum");
    }
}
static size_t weighted_graphs(void)
{
    const int weights[] = {0,-2,0,3}; size_t cases = 0;
    for (unsigned long code = 0; code < 262144UL; code++) {
        Graph g; REQUIRE(graph_init(&g, 3, 1) == G_OK, "weighted graph init"); unsigned long value = code; int negative = 0;
        for (size_t u = 0; u < 3; u++) { for (size_t v = 0; v < 3; v++) {
            size_t choice = value % 4; value /= 4;
            if (choice) { REQUIRE(graph_add(&g, u, v, weights[choice]) == G_OK, "weighted edge"); if (weights[choice] < 0) { negative = 1; } }
        } }
        Oracle oracle = reference(&g); AllPairs all;
        REQUIRE(graph_floyd(&g, &all) == G_OK && all.n == 3, "Floyd runs bounded graph");
        for (size_t s = 0; s < 3; s++) {
            Shortest paths; REQUIRE(graph_bellman(&g, s, &paths) == G_OK, "Bellman complete analysis"); check_paths(&g, &oracle, s, &paths);
            for (size_t t = 0; t < 3; t++) {
                PathState state = expected_state(&oracle, 3, s, t);
                REQUIRE(all.state[s][t] == state, "Floyd simple cycle oracle");
                if (state == PATH_FINITE) { REQUIRE(all.distance[s][t] == oracle.best[s][t], "Floyd finite distance"); }
            }
            Shortest before = {0}; before.n = 777; paths = before;
            GStatus status = graph_dijkstra(&g, s, &paths);
            if (negative) { REQUIRE(status == G_NEGATIVE && memcmp(&paths, &before, sizeof paths) == 0, "Dijkstra rejects any negative edge"); }
            else { REQUIRE(status == G_OK, "Dijkstra nonnegative success"); check_paths(&g, &oracle, s, &paths); }
        }
        cases++;
    }
    return cases;
}
static void bounds(void)
{
    long out = 19;
    REQUIRE(graph_cost_sum(LONG_MAX, 1, &out) == G_RANGE && out == 19 && graph_cost_sum(LONG_MIN, -1, &out) == G_RANGE && out == 19, "checked overflow no expression overflow");
    REQUIRE(graph_cost_sum(LONG_MIN, LONG_MAX, &out) == G_OK && out == -1 && graph_cost_sum(0, LONG_MIN, &out) == G_OK && out == LONG_MIN && graph_cost_sum(1, 2, NULL) == G_INVALID, "checked addition endpoints");
    Graph g; Shortest paths; AllPairs all;
    for (int sign = -1; sign <= 1; sign += 2) {
        REQUIRE(graph_init(&g, 8, 1) == G_OK, "boundary chain graph");
        for (size_t u = 0; u + 1 < 8; u++) { REQUIRE(graph_add(&g, u, u + 1, sign * 1000) == G_OK, "boundary chain edge"); }
        REQUIRE(graph_bellman(&g, 0, &paths) == G_OK && paths.distance[7] == sign * 7000L && graph_floyd(&g, &all) == G_OK && all.distance[0][7] == sign * 7000L, "maximum finite path magnitude");
        GraphPath path; REQUIRE(graph_path(&paths, 7, &path) == G_OK && path.count == 8, "maximum path vertices");
        if (sign > 0) { REQUIRE(graph_dijkstra(&g, 0, &paths) == G_OK && paths.distance[7] == 7000, "maximum nonnegative chain"); }
    }
    REQUIRE(graph_init(&g, 8, 1) == G_OK, "dense negative graph");
    for (size_t u = 0; u < 8; u++) { for (size_t v = 0; v < 8; v++) { REQUIRE(graph_add(&g, u, v, -1000) == G_OK, "dense negative edge"); } }
    REQUIRE(graph_floyd(&g, &all) == G_OK, "staged Floyd numeric bound");
    for (size_t s = 0; s < 8; s++) {
        REQUIRE(graph_bellman(&g, s, &paths) == G_OK, "dense Bellman bound");
        for (size_t t = 0; t < 8; t++) { REQUIRE(paths.state[t] == PATH_NEGATIVE && all.state[s][t] == PATH_NEGATIVE, "dense negative affected"); }
    }
    REQUIRE(graph_init(&g, 8, 1) == G_OK && graph_add(&g, 7, 7, -1000) == G_OK && graph_add(&g, 0, 1, 0) == G_OK, "isolated negative cycle");
    REQUIRE(graph_bellman(&g, 0, &paths) == G_OK && paths.state[0] == PATH_FINITE && paths.state[1] == PATH_FINITE && paths.state[7] == PATH_UNREACHABLE, "unreachable cycle not source affected");
    REQUIRE(graph_floyd(&g, &all) == G_OK && all.state[0][7] == PATH_UNREACHABLE && all.state[7][7] == PATH_NEGATIVE && all.state[0][0] == PATH_FINITE, "pair-specific negative cycle");
    REQUIRE(graph_init(&g, 2, 0) == G_OK && graph_add(&g, 0, 1, -1) == G_OK && graph_bellman(&g, 0, &paths) == G_OK && paths.state[0] == PATH_NEGATIVE && paths.state[1] == PATH_NEGATIVE, "undirected negative edge walk");
    Shortest old = {0}; old.n = 777; paths = old;
    REQUIRE(graph_bellman(&g, 2, &paths) == G_INVALID && graph_dijkstra(NULL, 0, &paths) == G_INVALID && memcmp(&paths, &old, sizeof old) == 0, "invalid path call preserves");
    REQUIRE(graph_floyd(&g, NULL) == G_INVALID && graph_path(NULL, 0, NULL) == G_INVALID, "null shortest outputs");
    REQUIRE(graph_init(&g, 0, 1) == G_OK && graph_floyd(&g, &all) == G_OK && all.n == 0 && graph_bellman(&g, 0, &paths) == G_INVALID, "empty shortest conventions");
}
int main(void)
{
    size_t graphs = weighted_graphs(); bounds(); printf("weighted_graphs=%zu simple_path_cycle_oracle=1 numeric_boundaries=1\n", graphs); return 0;
}
