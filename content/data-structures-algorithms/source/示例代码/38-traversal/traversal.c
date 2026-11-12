#include "traversal.h"
static void recursive(const TreeNode *node, WalkOrder order, int *out, size_t *n)
{
    if (node == NULL) { return; }
    if (order == WALK_PRE) { out[(*n)++] = node->value; }
    recursive(node->left, order, out, n);
    if (order == WALK_IN) { out[(*n)++] = node->value; }
    recursive(node->right, order, out, n);
    if (order == WALK_POST) { out[(*n)++] = node->value; }
}
TStatus tree_walk(const BinaryTree *tree, WalkOrder order, int *out, size_t capacity, size_t *out_count)
{
    if (out_count == NULL || (tree->count != 0 && out == NULL) || order < WALK_PRE || order > WALK_POST_STACK) { return T_INVALID; }
    if (capacity < tree->count) { return T_SPACE; }
    size_t n = 0;
    if (order <= WALK_POST) { recursive(tree->root, order, out, &n); }
    else if (order == WALK_LEVEL) {
        const TreeNode *queue[TREE_LIMIT]; size_t head = 0, tail = 0;
        if (tree->root != NULL) { queue[tail++] = tree->root; }
        while (head < tail) {
            const TreeNode *node = queue[head++]; out[n++] = node->value;
            if (node->left != NULL) { queue[tail++] = node->left; }
            if (node->right != NULL) { queue[tail++] = node->right; }
        }
    }
    else if (order == WALK_PRE_STACK) {
        const TreeNode *stack[TREE_LIMIT]; size_t top = 0;
        if (tree->root != NULL) { stack[top++] = tree->root; }
        while (top != 0) {
            const TreeNode *node = stack[--top]; out[n++] = node->value;
            if (node->right != NULL) { stack[top++] = node->right; }
            if (node->left != NULL) { stack[top++] = node->left; }
        }
    }
    else if (order == WALK_IN_STACK) {
        const TreeNode *stack[TREE_LIMIT], *node = tree->root; size_t top = 0;
        while (node != NULL || top != 0) {
            while (node != NULL) { stack[top++] = node; node = node->left; }
            node = stack[--top]; out[n++] = node->value; node = node->right;
        }
    }
    else {
        typedef struct { const TreeNode *node; int expanded; } Frame;
        Frame stack[2 * TREE_LIMIT]; size_t top = 0;
        if (tree->root != NULL) { stack[top++] = (Frame){tree->root, 0}; }
        while (top != 0) {
            Frame frame = stack[--top];
            if (frame.expanded) { out[n++] = frame.node->value; }
            else {
                stack[top++] = (Frame){frame.node, 1};
                if (frame.node->right != NULL) { stack[top++] = (Frame){frame.node->right, 0}; }
                if (frame.node->left != NULL) { stack[top++] = (Frame){frame.node->left, 0}; }
            }
        }
    }
    *out_count = n;
    return T_OK;
}
