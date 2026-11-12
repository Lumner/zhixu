#include "avl.h"
#include <stdlib.h>
void avl_init(AVL *tree) { tree->root = NULL; tree->count = 0; }
static void release(ANode *node)
{
    if (node != NULL) { release(node->left); release(node->right); free(node); }
}
void avl_clear(AVL *tree) { release(tree->root); avl_init(tree); }
static int height(const ANode *node) { return node == NULL ? 0 : node->height; }
static void refresh(ANode *node)
{
    int left = height(node->left), right = height(node->right);
    node->height = 1 + (left > right ? left : right);
}
static ANode *rotate_right(ANode *top)
{
    ANode *next = top->left; ANode *middle = next->right;
    next->right = top; top->left = middle;
    refresh(top); refresh(next); return next;
}
static ANode *rotate_left(ANode *top)
{
    ANode *next = top->right; ANode *middle = next->left;
    next->left = top; top->right = middle;
    refresh(top); refresh(next); return next;
}
int avl_contains(const AVL *tree, int key)
{
    const ANode *node = tree->root;
    while (node != NULL) {
        if (key == node->key) { return 1; }
        node = key < node->key ? node->left : node->right;
    }
    return 0;
}
static ANode *insert_node(ANode *node, int key, TStatus *status)
{
    if (node == NULL) {
        ANode *created = malloc(sizeof *created);
        if (created == NULL) { *status = T_MEMORY; return NULL; }
        *created = (ANode){key, 1, NULL, NULL}; return created;
    }
    if (key < node->key) {
        ANode *child = insert_node(node->left, key, status);
        if (*status != T_OK) { return node; }
        node->left = child;
    }
    else {
        ANode *child = insert_node(node->right, key, status);
        if (*status != T_OK) { return node; }
        node->right = child;
    }
    refresh(node);
    int balance = height(node->left) - height(node->right);
    if (balance > 1) {
        if (key > node->left->key) { node->left = rotate_left(node->left); }
        return rotate_right(node);
    }
    if (balance < -1) {
        if (key < node->right->key) { node->right = rotate_right(node->right); }
        return rotate_left(node);
    }
    return node;
}
TStatus avl_insert(AVL *tree, int key)
{
    if (avl_contains(tree, key)) { return T_DUPLICATE; }
    if (tree->count == TREE_LIMIT) { return T_FULL; }
    TStatus status = T_OK;
    tree->root = insert_node(tree->root, key, &status);
    if (status == T_OK) { tree->count++; }
    return status;
}
static void collect(const ANode *node, int *out, size_t *n)
{
    if (node != NULL) { collect(node->left, out, n); out[(*n)++] = node->key; collect(node->right, out, n); }
}
TStatus avl_inorder(const AVL *tree, int *out, size_t capacity, size_t *out_count)
{
    if (out_count == NULL || (tree->count != 0 && out == NULL)) { return T_INVALID; }
    if (capacity < tree->count) { return T_SPACE; }
    size_t n = 0; collect(tree->root, out, &n); *out_count = n; return T_OK;
}
