#include "topological.h"
#include <stdio.h>
int main(void)
{
    Graph graph; Topological order = {0};
    if (graph_init(&graph, 4, 1) != G_OK || graph_add(&graph, 0, 2, 1) != G_OK || graph_add(&graph, 1, 2, 1) != G_OK || graph_add(&graph, 2, 3, 1) != G_OK || graph_topological(&graph, &order) != G_OK) { return 1; }
    printf("order="); for (size_t i = 0; i < order.count; i++) { printf("%s%zu", i ? "," : "", order.vertices[i]); }
    if (graph_add(&graph, 3, 1, 1) != G_OK) { return 1; }
    printf("\ncycle=%d old_count=%zu\n", graph_topological(&graph, &order) == G_CYCLE, order.count); return 0;
}
