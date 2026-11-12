#ifndef DSA_TREE_TRAVERSAL_H
#define DSA_TREE_TRAVERSAL_H
#include "tree.h"
typedef enum { WALK_PRE, WALK_IN, WALK_POST, WALK_LEVEL, WALK_PRE_STACK, WALK_IN_STACK, WALK_POST_STACK } WalkOrder;
TStatus tree_walk(const BinaryTree *tree, WalkOrder order, int *out, size_t capacity, size_t *out_count);
#endif
