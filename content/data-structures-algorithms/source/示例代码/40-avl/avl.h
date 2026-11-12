#ifndef DSA_AVL_H
#define DSA_AVL_H
#include "tree_status.h"
typedef struct ANode { int key; int height; struct ANode *left; struct ANode *right; } ANode;
typedef struct { ANode *root; size_t count; } AVL;
void avl_init(AVL *tree);
void avl_clear(AVL *tree);
int avl_contains(const AVL *tree, int key);
TStatus avl_insert(AVL *tree, int key);
TStatus avl_inorder(const AVL *tree, int *out, size_t capacity, size_t *out_count);
#endif
