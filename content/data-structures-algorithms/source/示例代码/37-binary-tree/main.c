#include "tree.h"
#include <stdio.h>
int main(void)
{
    const TreeToken tokens[] = {{1,4},{1,2},{1,1},{0,0},{0,0},{1,3},{0,0},{0,0},{1,6},{0,0},{0,0}};
    BinaryTree tree; tree_init(&tree);
    if (tree_build(&tree, tokens, sizeof tokens / sizeof tokens[0]) != T_OK) { return 1; }
    printf("nodes=%zu height=%zu\n", tree.count, tree_height(&tree));
    tree_clear(&tree);
    printf("empty_nodes=%zu empty_height=%zu\n", tree.count, tree_height(&tree));
    return 0;
}
