#ifndef DSA_BST_H
#define DSA_BST_H
#include "tree_status.h"
typedef struct BNode { int key; struct BNode *left; struct BNode *right; } BNode;
typedef struct { BNode *root; size_t count; } BST;
void bst_init(BST *tree);
void bst_clear(BST *tree);
int bst_contains(const BST *tree, int key);
TStatus bst_insert(BST *tree, int key);
TStatus bst_erase(BST *tree, int key);
TStatus bst_min(const BST *tree, int *out);
TStatus bst_inorder(const BST *tree, int *out, size_t capacity, size_t *out_count);
#endif
