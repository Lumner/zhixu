#include "shortest.h"
#include <stdio.h>
int main(void)
{
    Graph graph; Shortest paths;
    if (graph_init(&graph, 5, 1) != G_OK || graph_add(&graph, 0, 1, 1) != G_OK || graph_add(&graph, 1, 2, -2) != G_OK || graph_add(&graph, 2, 1, 1) != G_OK || graph_add(&graph, 2, 3, 4) != G_OK || graph_bellman(&graph, 0, &paths) != G_OK) { return 1; }
    for (size_t v = 0; v < graph.n; v++) {
        printf("%zu %s", v, path_state_name(paths.state[v]));
        if (paths.state[v] == PATH_FINITE) { printf(" %ld", paths.distance[v]); }
        putchar('\n');
    }
    return 0;
}
