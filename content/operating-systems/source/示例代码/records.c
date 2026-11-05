#include <stdio.h>
#include <stdlib.h>

struct Task { int id; int minutes; };

int main(void) {
    size_t count = 3;
    struct Task *tasks = calloc(count, sizeof *tasks);
    if (tasks == NULL) { perror("calloc"); return 1; }
    int total = 0;
    for (size_t i = 0; i < count; i++) {
        tasks[i].id = (int)i + 1;
        tasks[i].minutes = ((int)i + 1) * 10;
        total += tasks[i].minutes;
    }
    printf("records=%zu total=%d\n", count, total);
    free(tasks);
    tasks = NULL;
    return 0;
}
