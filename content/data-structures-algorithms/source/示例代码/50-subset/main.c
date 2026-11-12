#include <stdio.h>
#include "subset.h"
int main(void)
{
    unsigned values[] = {3,1,2,0};
    SubsetResult plain, bounded;
    if (subset_sums(values, 4, 3, 0, &plain) != D_OK ||
        subset_sums(values, 4, 3, 1, &bounded) != D_OK) { return 1; }
    printf("solutions=%zu masks=", bounded.count);
    for (size_t i = 0; i < bounded.count; i++) {
        printf("%s%u", i == 0 ? "" : ",", bounded.masks[i]);
    }
    printf("\nplain_nodes=%lu pruned_nodes=%lu cuts=%lu\n",
           plain.nodes, bounded.nodes, bounded.pruned);
    return 0;
}
