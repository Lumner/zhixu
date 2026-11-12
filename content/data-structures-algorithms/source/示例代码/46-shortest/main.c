#include "shortest.h"
#include <stdio.h>
int main(void)
{
    Graph graph; Shortest paths; GraphPath path;
    if (graph_init(&graph, 5, 1) != G_OK || graph_add(&graph, 0, 1, 4) != G_OK || graph_add(&graph, 0, 2, 1) != G_OK || graph_add(&graph, 2, 1, 2) != G_OK || graph_add(&graph, 1, 3, 1) != G_OK || graph_add(&graph, 2, 3, 5) != G_OK || graph_dijkstra(&graph, 0, &paths) != G_OK || graph_path(&paths, 3, &path) != G_OK) { return 1; }
    printf("cost=%ld path=", path.cost);
    for (size_t i = 0; i < path.count; i++) { printf("%s%zu", i ? "," : "", path.vertices[i]); }
    printf("\nvertex4=%s\n", path_state_name(paths.state[4])); return 0;
}
