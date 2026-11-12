#include "heap.h"
#include <stdio.h>
int main(void)
{
    const Job jobs[] = {{3,30},{1,20},{1,10},{2,40}}; MinHeap heap; heap_init(&heap);
    if (heap_build(&heap, jobs, 4) != T_OK) { return 1; }
    while (heap.count != 0) {
        Job job; if (heap_pop(&heap, &job) != T_OK) { return 1; }
        printf("priority=%d id=%d\n", job.priority, job.id);
    }
    return 0;
}
