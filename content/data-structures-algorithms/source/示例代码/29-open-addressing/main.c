#include "open_map.h"
#include <stdio.h>
int main(void)
{
    OpenMap map;
    open_init(&map);
    if (open_put(&map, 0, 10) != H_OK || open_put(&map, 8, 80) != H_OK ||
        open_put(&map, 16, 160) != H_OK || open_erase(&map, 8) != H_OK) {
        open_clear(&map);
        return 1;
    }
    int value;
    if (open_get(&map, 16, &value) != H_OK) {
        open_clear(&map);
        return 1;
    }
    printf("after_delete key16=%d count=%zu used=%zu capacity=%zu\n", value, map.count, map.used, map.capacity);
    printf("duplicate=%d\n", open_put(&map, 16, 999) == H_DUPLICATE);
    if (open_put(&map, 24, 240) != H_OK || open_rehash(&map, 16) != H_OK) {
        open_clear(&map);
        return 1;
    }
    printf("after_rehash count=%zu used=%zu capacity=%zu\n", map.count, map.used, map.capacity);
    open_clear(&map);
    return 0;
}
