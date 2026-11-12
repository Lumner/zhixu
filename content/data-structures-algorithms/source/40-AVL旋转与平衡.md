# 40 AVL插入、旋转与平衡

## 40.1 目标与先修

先完成BST和树高，建议7—10小时，分两到三次学习。目标是检查每个节点的平衡因子，手推LL/RR/LR/RL，理解旋转为何保留中序，维护缓存高度，并说明本实现只提供插入、不冒充完整AVL库。

普通BST遇连续键可能长成链。**AVL**在BST顺序之外，再要求每个节点左右子树高度差至多1；插入引起失衡时，用局部重新连接恢复，而不把整树全部排序重建。

## 40.2 高度缓存与平衡因子

沿用空高0、叶高1。节点height=1+max(左高,右高)，**平衡因子balance**=左高-右高，合法值-1、0、1。必须每个节点都满足，根看起来平衡而内部有长链仍不是AVL。

height缓存使取孩子高度O(1)，但修改后必须更新。若每层再递归扫描整棵子树算高，会把本应沿一条路径完成的插入拖慢。缓存是要维护的不变量，不是写了字段名就自动正确。

## 40.3 右旋怎样保留次序

左侧过高的一种形状：

```text
        y                 x
       / \               / \
      x  T3    右旋     T1  y
     / \                   / \
    T1 T2                 T2 T3
```

BST原来保证T1<x<T2<y<T3，旋转后中序仍是T1,x,T2,y,T3。关键是把x的右子树T2接为y的左子树，不能丢掉或同时挂在两个地方。函数返回新子树根x，父调用者必须接住返回值。

先更新下方旧根y高度，再更新新根x，因为x的新高度依赖y更新后的值。左旋完全对称：右孩子上升，转移它的左子树。

## 40.4 LL与RR：一次旋转

LL指从最低失衡节点向新增位置的路径先左后左，例30、20、10。30左高2、右高0，右旋30后根20、左10、右30，高度2。

RR例10、20、30，向右再向右，左旋10后同样根20。名称描述插入方向，修复的旋转方向与重侧相反；不要把“LL”误记成要做左旋。

## 40.5 LR与RL：先把折线变直

LR例30、10、20：30左重，但新键在左孩子10右侧，直接右旋可能仍不平衡。先对10左旋，再对30右旋，根20、左10、右30。

RL例10、30、20：先对右孩子30右旋，再对10左旋。四个三节点例子最终形状相同，过程却不同；练习应画中间状态，不能只背最终根20。

```text
LR：   30        30        20
      /         /        /  \
     10   ->   20   ->  10  30
       \      /
       20    10
```

## 40.6 插入沿返回路径修复

先按BST路径找到空位并申请新叶，成功后逐层回到祖先：连接新子树、refresh当前高度、计算balance；左高差>1时按新键在左孩子的哪边决定LL/LR，右高差<-1时决定RR/RL。

公开接口先contains拒绝重复，再检查63项预算，因而私有insert_node只处理新键，不在相等分支另定规则。每次旋转返回新根；顶层也要更新tree.root，不能假设原根永远不动。

失败保证来自顺序：递归孩子失败就直接返回旧node，不改孩子指针、不更新高度也不旋转。整条路径尚未提交变化，旧树保持。成功申请新叶之后，余下旋转与高度维护不再申请内存，因此不会修了一半又遇到分配失败。

## 40.7 完整C实现

接口 [avl.h](示例代码/40-avl/avl.h)，完整文件avl.c：

```c
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
```

所有int键合法，重复T_DUPLICATE、满63项T_FULL、申请失败T_MEMORY。中序输出规则与BST一致，错误保持数组与数量。对象有效且先init后clear，不能复制拥有者或手改height/链接。

本版有contains、insert、inorder、clear，没有AVL删除。BST删除实现不能直接拿来删AVL并继续宣称平衡；删除的高度变化与回溯规则需要另行设计，当前课程明确不提供这个API。

## 40.8 高度为什么保持对数

设高度h的合法AVL最少节点数为N(h)。N(0)=0、N(1)=1。要让高度h而节点最少，一边高h-1，另一边至少h-2，所以N(h)=1+N(h-1)+N(h-2)。

这个增长至少每两层大致翻倍，因此高度随节点数只按对数增长；可得到宽松界h<=2log₂(n+1)。不用先背斐波那契公式，也能看出不能无限长成只有一侧的链。

查找与插入O(log n)，沿路径每个节点更新高度/局部旋转O(1)；节点空间O(n)，插入递归栈O(log n)。中序/clear仍Θ(n)。平衡不是让左右节点数量相等，也不是每层都满。

## 40.9 编译与四种失衡结果

把 [avl.h](示例代码/40-avl/avl.h)、[avl.c](示例代码/40-avl/avl.c)、[main.c](示例代码/40-avl/main.c)、[共享头](示例代码/stage7-common/tree_status.h) 放自己的`~/dsa-labs/ch40`。在 **UCRT64 Bash、该目录**：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic main.c avl.c -o avl.exe
./avl.exe
```

预期四行：

```text
LL root=20 height=2 left=10 right=30
RR root=20 height=2 left=10 right=30
LR root=20 height=2 left=10 right=30
RL root=20 height=2 left=10 right=30
```

这四例用于理解，不足以证明所有情况。配套测试还核对5,914种小规模插入排列的每步全局顺序、真实高度和缓存平衡，详见 [验证](验证/第七阶段验证记录.md)。

## 40.10 红黑树与B树概览

红黑树用颜色与路径约束控制高度，是另一套平衡规则，并非把AVL的height字段改成颜色就能使用；本课不实现其插入/删除。B树是平衡多路搜索树，一个节点可有多个键和孩子，有利于减少外存页访问层数；它不是“二叉树”的英文缩写，B+树也有另外的结构约束。

这些是理解数据结构选择的概览，没有注册成已实现例程。不必先掌握数据库索引实现才能继续下一章堆；先把当前AVL旋转和不变量学会。

## 40.11 常见错误

只检查根平衡；缓存未更新；先刷新新根再刷新旧根；转移T2丢失或共享；父节点没接旋转新根；LR/RL只做一次；LL名称与旋转方向混淆；分配失败仍更新祖先；重复键插入后计数增加；直接套BST删除；把概览说成完整红黑/B树实现。

## 40.12 练习与参考答案

练习一：左高3右高1，balance多少？答案：2，失衡；还需看插入方向决定LL或LR。

练习二：右旋前x.right为T2，旋转后去哪？答案：原根y.left=T2，x.right=y。

练习三：为什么先refresh旧根？答案：它成为新根的孩子，新根高度必须使用孩子的新高度。

## 40.13 完成条件

能画四类及双旋中间状态，解释顺序与高度同时保持，运行演示和单调插入对照，说明当前没有AVL删除。下一章把形状约束与优先级结合成二叉堆。
