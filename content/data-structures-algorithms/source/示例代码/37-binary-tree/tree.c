#include "tree.h"
#include <stdlib.h>
static void release(TreeNode *node)
{
    if (node != NULL) { release(node->left); release(node->right); free(node); }
}
void tree_init(BinaryTree *tree) { tree->root = NULL; tree->count = 0; }
void tree_clear(BinaryTree *tree) { release(tree->root); tree_init(tree); }
static TStatus parse(const TreeToken *tokens, size_t n, size_t *position, size_t *nodes, TreeNode **out)
{
    if (*position == n) { return T_INVALID; }
    TreeToken token = tokens[(*position)++];
    if (token.present == 0) { *out = NULL; return T_OK; }
    if (token.present != 1) { return T_INVALID; }
    if (*nodes == TREE_LIMIT) { return T_FULL; }
    TreeNode *node = malloc(sizeof *node);
    if (node == NULL) { return T_MEMORY; }
    node->value = token.value; node->left = node->right = NULL; (*nodes)++;
    TStatus status = parse(tokens, n, position, nodes, &node->left);
    if (status == T_OK) { status = parse(tokens, n, position, nodes, &node->right); }
    if (status != T_OK) { release(node); return status; }
    *out = node;
    return T_OK;
}
TStatus tree_build(BinaryTree *tree, const TreeToken *tokens, size_t count)
{
    if (tokens == NULL || count == 0) { return T_INVALID; }
    if (count > 2 * TREE_LIMIT + 1) { return T_FULL; }
    TreeNode *root = NULL; size_t position = 0, nodes = 0;
    TStatus status = parse(tokens, count, &position, &nodes, &root);
    if (status == T_OK && position != count) { status = T_INVALID; }
    if (status != T_OK) { release(root); return status; }
    tree_clear(tree); tree->root = root; tree->count = nodes;
    return T_OK;
}
static size_t height(const TreeNode *node)
{
    if (node == NULL) { return 0; }
    size_t left = height(node->left), right = height(node->right);
    return 1 + (left > right ? left : right);
}
size_t tree_height(const BinaryTree *tree) { return height(tree->root); }
