#include "bst.h"
#include <stdlib.h>
void bst_init(BST *tree) { tree->root = NULL; tree->count = 0; }
static void release(BNode *node)
{
    if (node != NULL) { release(node->left); release(node->right); free(node); }
}
void bst_clear(BST *tree) { release(tree->root); bst_init(tree); }
int bst_contains(const BST *tree, int key)
{
    const BNode *node = tree->root;
    while (node != NULL) {
        if (key == node->key) { return 1; }
        node = key < node->key ? node->left : node->right;
    }
    return 0;
}
TStatus bst_insert(BST *tree, int key)
{
    BNode *parent = NULL, *node = tree->root;
    while (node != NULL) {
        if (key == node->key) { return T_DUPLICATE; }
        parent = node; node = key < node->key ? node->left : node->right;
    }
    if (tree->count == TREE_LIMIT) { return T_FULL; }
    node = malloc(sizeof *node);
    if (node == NULL) { return T_MEMORY; }
    node->key = key; node->left = node->right = NULL;
    if (parent == NULL) { tree->root = node; }
    else if (key < parent->key) { parent->left = node; }
    else { parent->right = node; }
    tree->count++; return T_OK;
}
static BNode *erase_node(BNode *node, int key)
{
    if (key < node->key) { node->left = erase_node(node->left, key); }
    else if (key > node->key) { node->right = erase_node(node->right, key); }
    else if (node->left == NULL || node->right == NULL) {
        BNode *child = node->left != NULL ? node->left : node->right;
        free(node); return child;
    }
    else {
        BNode *successor = node->right;
        while (successor->left != NULL) { successor = successor->left; }
        node->key = successor->key;
        node->right = erase_node(node->right, successor->key);
    }
    return node;
}
TStatus bst_erase(BST *tree, int key)
{
    if (!bst_contains(tree, key)) { return T_MISSING; }
    tree->root = erase_node(tree->root, key); tree->count--; return T_OK;
}
TStatus bst_min(const BST *tree, int *out)
{
    if (out == NULL) { return T_INVALID; }
    const BNode *node = tree->root;
    if (node == NULL) { return T_EMPTY; }
    while (node->left != NULL) { node = node->left; }
    *out = node->key; return T_OK;
}
static void collect(const BNode *node, int *out, size_t *n)
{
    if (node != NULL) { collect(node->left, out, n); out[(*n)++] = node->key; collect(node->right, out, n); }
}
TStatus bst_inorder(const BST *tree, int *out, size_t capacity, size_t *out_count)
{
    if (out_count == NULL || (tree->count != 0 && out == NULL)) { return T_INVALID; }
    if (capacity < tree->count) { return T_SPACE; }
    size_t n = 0; collect(tree->root, out, &n); *out_count = n; return T_OK;
}
