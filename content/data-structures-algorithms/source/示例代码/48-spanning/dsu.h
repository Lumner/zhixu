#ifndef DSA_DISJOINT_SET_H
#define DSA_DISJOINT_SET_H
#include "graph.h"
typedef struct { size_t n; size_t components; size_t parent[GRAPH_MAX]; size_t size[GRAPH_MAX]; } DisjointSet;
GStatus dsu_init(DisjointSet *sets, size_t n);
GStatus dsu_find(DisjointSet *sets, size_t value, size_t *out);
GStatus dsu_union(DisjointSet *sets, size_t a, size_t b, int *merged);
#endif
