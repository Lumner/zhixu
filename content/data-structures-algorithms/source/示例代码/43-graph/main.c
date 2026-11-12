#include "graph.h"
#include <stdio.h>
int main(void)
{
    Graph graph; Adjacency list;
    if (graph_init(&graph, 4, 0) != G_OK || graph_add(&graph, 0, 1, 0) != G_OK || graph_add(&graph, 0, 2, 5) != G_OK || graph_add(&graph, 2, 2, -1) != G_OK || graph_adjacency(&graph, &list) != G_OK) { return 1; }
    printf("vertices=%zu edges=%zu arcs=%zu\n", graph.n, graph.edges, list.count);
    for (size_t u = 0; u < graph.n; u++) {
        printf("%zu:", u);
        for (size_t i = list.head[u]; i != GRAPH_ARCS; i = list.arcs[i].next) { printf(" %zu(%d)", list.arcs[i].to, list.arcs[i].weight); }
        putchar('\n');
    }
    printf("reverse_duplicate=%d\n", graph_add(&graph, 1, 0, 9) == G_DUPLICATE); return 0;
}
