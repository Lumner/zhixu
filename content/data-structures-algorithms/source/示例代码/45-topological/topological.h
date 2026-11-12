#ifndef DSA_TOPOLOGICAL_H
#define DSA_TOPOLOGICAL_H
#include "graph.h"
typedef struct { size_t vertices[GRAPH_MAX]; size_t count; } Topological;
GStatus graph_topological(const Graph *graph, Topological *out);
#endif
