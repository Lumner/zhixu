#include "walk.h"
#include <stdio.h>
int main(void)
{
    Graph graph; Walk dfs, bfs; Components components;
    if (graph_init(&graph, 5, 0) != G_OK || graph_add(&graph, 0, 1, 1) != G_OK || graph_add(&graph, 0, 3, 1) != G_OK || graph_add(&graph, 1, 2, 1) != G_OK || graph_add(&graph, 2, 3, 1) != G_OK || graph_dfs(&graph, 0, &dfs) != G_OK || graph_bfs(&graph, 0, &bfs) != G_OK || graph_components(&graph, &components) != G_OK) { return 1; }
    printf("dfs="); for (size_t i = 0; i < dfs.count; i++) { printf("%s%zu", i ? "," : "", dfs.order[i]); }
    printf("\nbfs="); for (size_t i = 0; i < bfs.count; i++) { printf("%s%zu", i ? "," : "", bfs.order[i]); }
    printf("\ndepth3 dfs=%zu bfs=%zu components=%zu\n", dfs.depth[3], bfs.depth[3], components.count); return 0;
}
