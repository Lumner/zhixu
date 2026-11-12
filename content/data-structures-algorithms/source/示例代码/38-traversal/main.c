#include "traversal.h"
#include <stdio.h>
int main(void)
{
    const TreeToken tokens[] = {{1,4},{1,2},{1,1},{0,0},{0,0},{1,3},{0,0},{0,0},{1,6},{0,0},{0,0}};
    const char *names[] = {"pre","in","post","level","pre-stack","in-stack","post-stack"};
    BinaryTree tree; tree_init(&tree);
    if (tree_build(&tree, tokens, sizeof tokens / sizeof tokens[0]) != T_OK) { return 1; }
    for (int order = WALK_PRE; order <= WALK_POST_STACK; order++) {
        int values[TREE_LIMIT]; size_t n;
        if (tree_walk(&tree, (WalkOrder)order, values, TREE_LIMIT, &n) != T_OK) { tree_clear(&tree); return 1; }
        printf("%s=", names[order]);
        for (size_t i = 0; i < n; i++) { printf("%s%d", i == 0 ? "" : ",", values[i]); }
        putchar('\n');
    }
    tree_clear(&tree); return 0;
}
