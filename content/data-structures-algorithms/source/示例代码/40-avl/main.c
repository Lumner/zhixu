#include "avl.h"
#include <stdio.h>
int main(void)
{
    const int inputs[4][3] = {{30,20,10},{10,20,30},{30,10,20},{10,30,20}};
    const char *names[] = {"LL","RR","LR","RL"};
    for (size_t k = 0; k < 4; k++) {
        AVL tree; avl_init(&tree);
        for (size_t i = 0; i < 3; i++) { if (avl_insert(&tree, inputs[k][i]) != T_OK) { avl_clear(&tree); return 1; } }
        printf("%s root=%d height=%d left=%d right=%d\n", names[k], tree.root->key, tree.root->height, tree.root->left->key, tree.root->right->key);
        avl_clear(&tree);
    }
    return 0;
}
