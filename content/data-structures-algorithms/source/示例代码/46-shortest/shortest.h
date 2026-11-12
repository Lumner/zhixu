#ifndef DSA_SHORTEST_PATH_H
#define DSA_SHORTEST_PATH_H
#include "graph.h"
typedef enum { PATH_UNREACHABLE, PATH_FINITE, PATH_NEGATIVE } PathState;
typedef struct { size_t n; size_t source; PathState state[GRAPH_MAX]; long distance[GRAPH_MAX]; size_t parent[GRAPH_MAX]; } Shortest;
typedef struct { size_t vertices[GRAPH_MAX]; size_t count; long cost; } GraphPath;
typedef struct { size_t n; PathState state[GRAPH_MAX][GRAPH_MAX]; long distance[GRAPH_MAX][GRAPH_MAX]; } AllPairs;
GStatus graph_dijkstra(const Graph *graph, size_t source, Shortest *out);
GStatus graph_bellman(const Graph *graph, size_t source, Shortest *out);
GStatus graph_floyd(const Graph *graph, AllPairs *out);
GStatus graph_path(const Shortest *paths, size_t target, GraphPath *out);
const char *path_state_name(PathState state);
#endif
