#include "chaining.h"
#include <stdio.h>
int main(void)
{
    ChainMap map;
    chain_init(&map);
    if (chain_put(&map, 1, 10) != H_OK || chain_put(&map, 9, 90) != H_OK ||
        chain_put(&map, 17, 170) != H_OK) {
        chain_clear(&map);
        return 1;
    }
    printf("bucket1=");
    for (const HNode *p = map.buckets[1]; p != NULL; p = p->next) {
        printf("%d%s", p->key, p->next == NULL ? "\n" : ",");
    }
    printf("duplicate=%d\n", chain_put(&map, 9, 999) == H_DUPLICATE);
    int value;
    if (chain_erase(&map, 9) != H_OK || chain_get(&map, 17, &value) != H_OK) {
        chain_clear(&map);
        return 1;
    }
    printf("key17=%d count=%zu\n", value, map.count);
    chain_clear(&map);
    return 0;
}
