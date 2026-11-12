#include "shortest.h"
#include <stdio.h>
int main(void)
{
    Graph graph; AllPairs paths;
    if (graph_init(&graph, 4, 1) != G_OK || graph_add(&graph, 0, 1, 4) != G_OK || graph_add(&graph, 1, 2, -2) != G_OK || graph_add(&graph, 0, 2, 5) != G_OK || graph_floyd(&graph, &paths) != G_OK) { return 1; }
    printf("d02=%ld state20=%s self3=%ld\n", paths.distance[0][2], path_state_name(paths.state[2][0]), paths.distance[3][3]);
    if (graph_add(&graph, 2, 1, 1) != G_OK || graph_floyd(&graph, &paths) != G_OK) { return 1; }
    printf("after_cycle 0to2=%s 0to0=%s\n", path_state_name(paths.state[0][2]), path_state_name(paths.state[0][0])); return 0;
}
