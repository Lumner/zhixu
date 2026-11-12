#ifndef DSA_BINARY_TREE_H
#define DSA_BINARY_TREE_H
#include "tree_status.h"
typedef struct TreeNode { int value; struct TreeNode *left; struct TreeNode *right; } TreeNode;
typedef struct { TreeNode *root; size_t count; } BinaryTree;
typedef struct { int present; int value; } TreeToken;
void tree_init(BinaryTree *tree);
void tree_clear(BinaryTree *tree);
TStatus tree_build(BinaryTree *tree, const TreeToken *tokens, size_t count);
size_t tree_height(const BinaryTree *tree);
#endif
