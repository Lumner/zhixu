#include "bst.h"
#include <stdio.h>
int main(void)
{
    const int keys[] = {4,2,6,1,3,5,7}; BST tree; bst_init(&tree);
    for (size_t i = 0; i < 7; i++) { if (bst_insert(&tree, keys[i]) != T_OK) { bst_clear(&tree); return 1; } }
    printf("duplicate=%d\n", bst_insert(&tree, 4) == T_DUPLICATE);
    if (bst_erase(&tree, 4) != T_OK) { bst_clear(&tree); return 1; }
    int out[TREE_LIMIT]; size_t n;
    if (bst_inorder(&tree, out, TREE_LIMIT, &n) != T_OK) { bst_clear(&tree); return 1; }
    printf("after-root-delete=");
    for (size_t i = 0; i < n; i++) { printf("%s%d", i == 0 ? "" : ",", out[i]); }
    printf("\ncontains4=%d count=%zu\n", bst_contains(&tree, 4), tree.count);
    bst_clear(&tree); return 0;
}
