#include "dsu.h"
GStatus dsu_init(DisjointSet *sets, size_t n)
{
    if (sets == NULL) { return G_INVALID; }
    if (n > GRAPH_MAX) { return G_RANGE; }
    DisjointSet next = {0}; next.n = next.components = n;
    for (size_t i = 0; i < n; i++) { next.parent[i] = i; next.size[i] = 1; }
    *sets = next; return G_OK;
}
GStatus dsu_find(DisjointSet *sets, size_t value, size_t *out)
{
    if (sets == NULL || out == NULL || value >= sets->n) { return G_INVALID; }
    size_t root = value;
    while (sets->parent[root] != root) { root = sets->parent[root]; }
    while (value != root) { size_t next = sets->parent[value]; sets->parent[value] = root; value = next; }
    *out = root; return G_OK;
}
GStatus dsu_union(DisjointSet *sets, size_t a, size_t b, int *merged)
{
    if (sets == NULL || merged == NULL || a >= sets->n || b >= sets->n) { return G_INVALID; }
    size_t ra, rb; (void)dsu_find(sets, a, &ra); (void)dsu_find(sets, b, &rb);
    *merged = 0;
    if (ra != rb) {
        if (sets->size[ra] < sets->size[rb] || (sets->size[ra] == sets->size[rb] && ra > rb)) { size_t saved = ra; ra = rb; rb = saved; }
        sets->parent[rb] = ra; sets->size[ra] += sets->size[rb]; sets->components--; *merged = 1;
    }
    return G_OK;
}
