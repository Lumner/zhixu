#ifndef DSA_GRAPH_WALK_H
#define DSA_GRAPH_WALK_H
#include "graph.h"
typedef struct { size_t n; size_t source; size_t order[GRAPH_MAX]; size_t count; size_t parent[GRAPH_MAX]; size_t depth[GRAPH_MAX]; } Walk;
typedef struct { size_t n; size_t label[GRAPH_MAX]; size_t count; } Components;
GStatus graph_dfs(const Graph *graph, size_t source, Walk *out);
GStatus graph_bfs(const Graph *graph, size_t source, Walk *out);
GStatus graph_components(const Graph *graph, Components *out);
#endif
