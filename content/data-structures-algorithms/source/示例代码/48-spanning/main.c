#include "spanning.h"
#include <stdio.h>
int main(void)
{
    Graph graph; Forest kruskal, prim;
    if (graph_init(&graph, 5, 0) != G_OK || graph_add(&graph, 0, 1, 3) != G_OK || graph_add(&graph, 0, 2, 1) != G_OK || graph_add(&graph, 1, 2, -1) != G_OK || graph_add(&graph, 1, 3, 2) != G_OK || graph_add(&graph, 2, 3, 4) != G_OK || graph_add(&graph, 0, 0, -100) != G_OK || graph_kruskal(&graph, &kruskal) != G_OK || graph_prim(&graph, &prim) != G_OK) { return 1; }
    printf("kruskal total=%ld edges=%zu components=%zu\n", kruskal.total, kruskal.count, kruskal.components);
    printf("prim total=%ld edges=%zu components=%zu\n", prim.total, prim.count, prim.components); return 0;
}
