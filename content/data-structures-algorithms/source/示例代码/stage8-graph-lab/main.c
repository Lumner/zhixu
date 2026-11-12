#include "topological.h"
#include "shortest.h"
#include <stdio.h>
#include <string.h>
static int vertex(const char *text, size_t *out)
{
    if (text[0] < '0' || text[0] > '7' || text[1] != '\0') { return 0; }
    *out = (size_t)(text[0] - '0'); return 1;
}
int main(int argc, char **argv)
{
    if (argc >= 2 && strcmp(argv[1], "study") == 0 && (argc == 2 || (argc == 3 && strcmp(argv[2], "cycle") == 0))) {
        const char *names[] = {"C","arrays","pointers","lists","graphs"}; Graph graph; Topological order;
        if (graph_init(&graph, 5, 1) != G_OK || graph_add(&graph, 0, 1, 1) != G_OK || graph_add(&graph, 0, 2, 1) != G_OK || graph_add(&graph, 1, 3, 1) != G_OK || graph_add(&graph, 2, 3, 1) != G_OK || graph_add(&graph, 3, 4, 1) != G_OK) { return 1; }
        if (argc == 3 && graph_add(&graph, 4, 0, 1) != G_OK) { return 1; }
        GStatus status = graph_topological(&graph, &order);
        if (status != G_OK) { fputs("graph-lab: dependency cycle\n", stderr); return 1; }
        for (size_t i = 0; i < order.count; i++) { printf("%s%s", i ? " -> " : "", names[order.vertices[i]]); }
        putchar('\n'); return 0;
    }
    if (argc == 4 && strcmp(argv[1], "route") == 0) {
        size_t source, target;
        if (!vertex(argv[2], &source) || !vertex(argv[3], &target)) { fputs("graph-lab: invalid vertex\n", stderr); return 1; }
        Graph graph; Shortest paths; GraphPath path;
        if (graph_init(&graph, 6, 0) != G_OK || graph_add(&graph, 0, 1, 4) != G_OK || graph_add(&graph, 0, 2, 2) != G_OK || graph_add(&graph, 2, 1, 1) != G_OK || graph_add(&graph, 1, 3, 5) != G_OK || graph_add(&graph, 2, 3, 8) != G_OK || graph_add(&graph, 3, 4, 2) != G_OK) { return 1; }
        if (source >= graph.n || target >= graph.n || graph_dijkstra(&graph, source, &paths) != G_OK) { fputs("graph-lab: invalid vertex\n", stderr); return 1; }
        GStatus status = graph_path(&paths, target, &path);
        if (status == G_MISSING) { puts("unreachable"); return 0; }
        if (status != G_OK) { fputs("graph-lab: path failed\n", stderr); return 1; }
        printf("cost=%ld path=", path.cost);
        for (size_t i = 0; i < path.count; i++) { printf("%s%zu", i ? "," : "", path.vertices[i]); }
        putchar('\n'); return 0;
    }
    fputs("usage: graph-lab study [cycle] | route source target\n", stderr); return 1;
}
