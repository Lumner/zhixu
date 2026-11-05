/* Model only: not a real page table. */
#include <stdio.h>

int main(void) {
    unsigned address = 13;
    unsigned page_size = 4;
    unsigned frames[] = {5, 2, 7, 1};
    unsigned page = address / page_size;
    unsigned offset = address % page_size;
    printf("page=%u offset=%u physical=%u\n",
           page, offset, frames[page] * page_size + offset);
    return 0;
}
