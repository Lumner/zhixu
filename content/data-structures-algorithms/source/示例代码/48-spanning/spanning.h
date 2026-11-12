#ifndef DSA_SPANNING_FOREST_H
#define DSA_SPANNING_FOREST_H
#include "graph.h"
typedef struct { size_t vertices; Edge edges[GRAPH_MAX]; size_t count; size_t components; long total; } Forest;
GStatus graph_kruskal(const Graph *graph, Forest *out);
GStatus graph_prim(const Graph *graph, Forest *out);
#endif
