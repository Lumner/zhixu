#ifndef DSA_GRAPH_H
#define DSA_GRAPH_H
#include <stddef.h>
#define GRAPH_MAX 8
#define GRAPH_ARCS (GRAPH_MAX * GRAPH_MAX)
#define GRAPH_WEIGHT_MAX 1000
typedef enum { G_OK, G_INVALID, G_RANGE, G_DUPLICATE, G_MISSING, G_SPACE, G_NEGATIVE, G_CYCLE } GStatus;
typedef struct { size_t from; size_t to; int weight; } Edge;
typedef struct { size_t n; int directed; size_t edges; unsigned char has[GRAPH_MAX][GRAPH_MAX]; int weight[GRAPH_MAX][GRAPH_MAX]; } Graph;
typedef struct { size_t to; int weight; size_t next; } Arc;
typedef struct { size_t n; size_t count; size_t head[GRAPH_MAX]; Arc arcs[GRAPH_ARCS]; } Adjacency;
GStatus graph_init(Graph *graph, size_t n, int directed);
GStatus graph_add(Graph *graph, size_t from, size_t to, int weight);
GStatus graph_remove(Graph *graph, size_t from, size_t to);
GStatus graph_adjacency(const Graph *graph, Adjacency *out);
#endif
