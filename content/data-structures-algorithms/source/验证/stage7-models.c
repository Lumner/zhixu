#include "stage6-test.h"
#include "traversal.h"
#include "bst.h"
#include "avl.h"
#include "heap.h"
#include "heapsort.h"
#include <limits.h>
#include <string.h>
static unsigned long seed = 20261111UL;
static unsigned int random_word(void)
{
    seed = (seed * 1664525UL + 1013904223UL) % 4294967296UL;
    return (unsigned int)(seed / 65536UL);
}
static int int_compare(const void *a, const void *b)
{
    int x = *(const int *)a, y = *(const int *)b; return x < y ? -1 : x > y ? 1 : 0;
}
typedef struct { int left; int right; } RefNode;
static int token_oracle(const TreeToken *tokens, size_t *pos, RefNode *nodes, int expected[3][TREE_LIMIT], size_t counts[3], size_t *height)
{
    TreeToken t = tokens[(*pos)++];
    if (!t.present) { *height = 0; return -1; }
    size_t left_h, right_h; expected[0][counts[0]++] = t.value;
    nodes[t.value].left = token_oracle(tokens, pos, nodes, expected, counts, &left_h);
    expected[1][counts[1]++] = t.value;
    nodes[t.value].right = token_oracle(tokens, pos, nodes, expected, counts, &right_h);
    expected[2][counts[2]++] = t.value;
    *height = 1 + (left_h > right_h ? left_h : right_h); return t.value;
}
static size_t tree_shapes(void)
{
    size_t cases = 0;
    for (size_t n = 0; n <= 7; n++) {
        size_t length = 2 * n + 1;
        for (unsigned int code = 0; code < (1U << length); code++) {
            TreeToken tokens[15]; int pending = 1; size_t real = 0; unsigned int value = code; int valid = 1;
            for (size_t i = 0; i < length; i++) {
                int present = (int)(value % 2); value /= 2;
                if (pending == 0) { valid = 0; break; }
                tokens[i] = (TreeToken){present, (int)real};
                if (present) { real++; pending++; } else { pending--; }
            }
            if (!valid || pending != 0 || real != n) { continue; }
            BinaryTree tree; tree_init(&tree);
            REQUIRE(tree_build(&tree, tokens, length) == T_OK && tree.count == n, "shape build");
            RefNode nodes[TREE_LIMIT]; int expected[3][TREE_LIMIT]; size_t counts[3] = {0}, position = 0, h;
            int root = token_oracle(tokens, &position, nodes, expected, counts, &h);
            REQUIRE(position == length && tree_height(&tree) == h, "token height oracle");
            int level[TREE_LIMIT], queue[TREE_LIMIT]; size_t head = 0, tail = 0, level_n = 0;
            if (root >= 0) { queue[tail++] = root; }
            while (head < tail) {
                int current = queue[head++]; level[level_n++] = current;
                if (nodes[current].left >= 0) { queue[tail++] = nodes[current].left; }
                if (nodes[current].right >= 0) { queue[tail++] = nodes[current].right; }
            }
            for (int order = WALK_PRE; order <= WALK_POST_STACK; order++) {
                int out[TREE_LIMIT]; size_t got = 999;
                REQUIRE(tree_walk(&tree, (WalkOrder)order, out, TREE_LIMIT, &got) == T_OK && got == n, "walk count");
                const int *ref = order == WALK_LEVEL ? level : expected[order < WALK_LEVEL ? order : order - WALK_PRE_STACK];
                for (size_t i = 0; i < n; i++) { REQUIRE(out[i] == ref[i], "token traversal oracle"); }
            }
            if (n == 0) { size_t got = 999; REQUIRE(tree_walk(&tree, WALK_POST_STACK, NULL, 0, &got) == T_OK && got == 0, "empty null output"); }
            int out[TREE_LIMIT] = {777}; size_t got = 999;
            if (n > 0) { REQUIRE(tree_walk(&tree, WALK_IN, out, n - 1, &got) == T_SPACE && out[0] == 777 && got == 999, "walk capacity preserves"); }
            REQUIRE(tree_walk(&tree, (WalkOrder)99, out, TREE_LIMIT, &got) == T_INVALID && out[0] == 777 && got == 999, "invalid walk order");
            REQUIRE(tree_walk(&tree, WALK_IN, out, TREE_LIMIT, NULL) == T_INVALID, "null walk count");
            tree_clear(&tree); REQUIRE(s6_live == 0, "shape release"); cases++;
        }
    }
    return cases;
}
static size_t bst_nodes(const BNode *node, int has_lo, int lo, int has_hi, int hi, size_t depth)
{
    if (node == NULL) { return 0; }
    REQUIRE(depth <= TREE_LIMIT && (!has_lo || node->key > lo) && (!has_hi || node->key < hi), "BST range invariant");
    return 1 + bst_nodes(node->left, has_lo, lo, 1, node->key, depth + 1) + bst_nodes(node->right, 1, node->key, has_hi, hi, depth + 1);
}
static int avl_nodes(const ANode *node, int has_lo, int lo, int has_hi, int hi, size_t *count, size_t depth)
{
    if (node == NULL) { return 0; }
    REQUIRE(depth <= TREE_LIMIT && (!has_lo || node->key > lo) && (!has_hi || node->key < hi), "AVL range invariant");
    (*count)++;
    int left = avl_nodes(node->left, has_lo, lo, 1, node->key, count, depth + 1);
    int right = avl_nodes(node->right, 1, node->key, has_hi, hi, count, depth + 1);
    int h = 1 + (left > right ? left : right);
    REQUIRE(node->height == h && left - right >= -1 && left - right <= 1, "AVL height balance"); return h;
}
static void check_bst(const BST *tree, const int *expected, size_t n)
{
    int values[TREE_LIMIT]; size_t got;
    REQUIRE(tree->count == n && bst_nodes(tree->root, 0, 0, 0, 0, 1) == n, "BST node count");
    REQUIRE(bst_inorder(tree, values, TREE_LIMIT, &got) == T_OK && got == n, "BST inorder count");
    for (size_t i = 0; i < n; i++) { REQUIRE(values[i] == expected[i] && bst_contains(tree, expected[i]), "BST reference set"); }
}
static void check_avl(const AVL *tree, const int *expected, size_t n)
{
    int values[TREE_LIMIT]; size_t got, count = 0;
    (void)avl_nodes(tree->root, 0, 0, 0, 0, &count, 1);
    REQUIRE(count == n && tree->count == n, "AVL node count");
    REQUIRE(avl_inorder(tree, values, TREE_LIMIT, &got) == T_OK && got == n, "AVL inorder count");
    for (size_t i = 0; i < n; i++) { REQUIRE(values[i] == expected[i] && avl_contains(tree, expected[i]), "AVL reference set"); }
}
static size_t permutations = 0;
static void permutation_case(int *keys, size_t n, size_t start)
{
    if (start != n) {
        for (size_t i = start; i < n; i++) {
            int saved = keys[start]; keys[start] = keys[i]; keys[i] = saved;
            permutation_case(keys, n, start + 1);
            saved = keys[start]; keys[start] = keys[i]; keys[i] = saved;
        }
        return;
    }
    BST bst; AVL avl; bst_init(&bst); avl_init(&avl); int expected[TREE_LIMIT]; size_t size = 0;
    for (size_t i = 0; i < n; i++) {
        REQUIRE(bst_insert(&bst, keys[i]) == T_OK && avl_insert(&avl, keys[i]) == T_OK, "permutation insert");
        expected[size++] = keys[i]; qsort(expected, size, sizeof *expected, int_compare);
        check_bst(&bst, expected, size); check_avl(&avl, expected, size);
        REQUIRE(bst_insert(&bst, keys[i]) == T_DUPLICATE && avl_insert(&avl, keys[i]) == T_DUPLICATE, "duplicate rejected");
    }
    for (size_t i = 0; i < n; i++) {
        REQUIRE(bst_erase(&bst, keys[i]) == T_OK && !bst_contains(&bst, keys[i]), "permutation erase");
        size_t j = 0; while (expected[j] != keys[i]) { j++; }
        memmove(expected + j, expected + j + 1, (size - j - 1) * sizeof *expected); size--;
        check_bst(&bst, expected, size);
        REQUIRE(bst_erase(&bst, keys[i]) == T_MISSING, "erase missing");
    }
    bst_clear(&bst); avl_clear(&avl); REQUIRE(s6_live == 0, "permutation release"); permutations++;
}
static void search_histories(void)
{
    for (size_t n = 0; n <= 7; n++) { int keys[7]; for (size_t i = 0; i < n; i++) { keys[i] = (int)i * 2 - 5; } permutation_case(keys, n, 0); }
    BST bst; bst_init(&bst); int present[96] = {0}; size_t size = 0;
    for (size_t step = 0; step < 10000; step++) {
        size_t k = random_word() % 96; int key = (int)k * 3 - 100;
        if (random_word() % 2 == 0) {
            TStatus status = present[k] ? T_DUPLICATE : size == TREE_LIMIT ? T_FULL : T_OK;
            REQUIRE(bst_insert(&bst, key) == status, "set-model insert");
            if (status == T_OK) { present[k] = 1; size++; }
        }
        else {
            REQUIRE(bst_erase(&bst, key) == (present[k] ? T_OK : T_MISSING), "set-model delete");
            if (present[k]) { present[k] = 0; size--; }
        }
        int expected[TREE_LIMIT]; size_t n = 0;
        for (size_t i = 0; i < 96; i++) { if (present[i]) { expected[n++] = (int)i * 3 - 100; } }
        check_bst(&bst, expected, n);
    }
    bst_clear(&bst); AVL avl; avl_init(&avl); int expected[TREE_LIMIT];
    for (int i = 0; i < TREE_LIMIT; i++) { expected[i] = i; REQUIRE(bst_insert(&bst, i) == T_OK && avl_insert(&avl, i) == T_OK, "capacity fill"); }
    check_bst(&bst, expected, TREE_LIMIT); check_avl(&avl, expected, TREE_LIMIT);
    size_t chain_height = 0; for (const BNode *p = bst.root; p != NULL; p = p->right) { chain_height++; }
    REQUIRE(chain_height == TREE_LIMIT && avl.root->height <= 12, "unbalanced versus AVL height");
    REQUIRE(bst_insert(&bst, 0) == T_DUPLICATE && avl_insert(&avl, 0) == T_DUPLICATE, "full duplicate priority");
    REQUIRE(bst_insert(&bst, 9999) == T_FULL && avl_insert(&avl, 9999) == T_FULL, "full new key");
    int out = 777; size_t got = 999;
    REQUIRE(bst_inorder(&bst, &out, 0, &got) == T_SPACE && out == 777 && got == 999, "BST short output");
    REQUIRE(avl_inorder(&avl, &out, 0, &got) == T_SPACE && out == 777 && got == 999, "AVL short output");
    REQUIRE(bst_min(&bst, NULL) == T_INVALID && bst_inorder(&bst, NULL, 63, &got) == T_INVALID && avl_inorder(&avl, NULL, 63, &got) == T_INVALID, "null outputs");
    bst_clear(&bst); avl_clear(&avl);
    REQUIRE(bst_min(&bst, &out) == T_EMPTY && out == 777, "empty minimum preserves");
    const int extremes[] = {INT_MIN, 0, INT_MAX};
    for (size_t i = 0; i < 3; i++) { REQUIRE(bst_insert(&bst, extremes[i]) == T_OK && avl_insert(&avl, extremes[i]) == T_OK, "extreme keys"); }
    check_bst(&bst, extremes, 3); check_avl(&avl, extremes, 3);
    REQUIRE(bst_min(&bst, &out) == T_OK && out == INT_MIN, "minimum extreme");
    bst_clear(&bst); avl_clear(&avl); REQUIRE(s6_live == 0, "search release");
}
static int job_compare(Job a, Job b)
{
    if (a.priority < b.priority) { return -1; } if (a.priority > b.priority) { return 1; }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
static void heap_histories(void)
{
    MinHeap heap; heap_init(&heap); Job model[TREE_LIMIT]; size_t size = 0;
    for (size_t step = 0; step < 20000; step++) {
        unsigned int action = random_word() % 3;
        if (action == 0) {
            Job job = {(int)(random_word() % 7) - 3, (int)(random_word() % 32)};
            REQUIRE(heap_push(&heap, job) == (size == TREE_LIMIT ? T_FULL : T_OK), "heap push model");
            if (size < TREE_LIMIT) { model[size++] = job; }
        }
        else {
            Job out = {777,888}; size_t best = 0;
            for (size_t i = 1; i < size; i++) { if (job_compare(model[i], model[best]) < 0) { best = i; } }
            TStatus status = action == 1 ? heap_pop(&heap, &out) : heap_peek(&heap, &out);
            REQUIRE(status == (size == 0 ? T_EMPTY : T_OK), "heap query status");
            if (size == 0) { REQUIRE(out.priority == 777 && out.id == 888, "empty heap preserves"); }
            else {
                REQUIRE(job_compare(out, model[best]) == 0, "heap minimum oracle");
                if (action == 1) { model[best] = model[--size]; }
            }
        }
        REQUIRE(heap.count == size, "heap count");
        for (size_t i = 1; i < size; i++) { REQUIRE(job_compare(heap.data[(i - 1) / 2], heap.data[i]) <= 0, "heap parent order"); }
    }
    Job data[TREE_LIMIT + 1]; for (int i = 0; i <= TREE_LIMIT; i++) { data[i] = (Job){TREE_LIMIT-i,i}; }
    for (size_t n = 0; n <= TREE_LIMIT; n++) {
        REQUIRE(heap_build(&heap, data, n) == T_OK, "bottom up build");
        for (size_t i = 0; i < n; i++) { Job out; REQUIRE(heap_pop(&heap, &out) == T_OK && out.id == (int)(n - 1 - i), "bottom up drain order"); }
    }
    REQUIRE(heap_build(&heap, data, TREE_LIMIT) == T_OK, "full heap build");
    REQUIRE(heap_build(&heap, data, TREE_LIMIT + 1) == T_FULL && heap.count == TREE_LIMIT, "oversized heap preserves");
    REQUIRE(heap_push(&heap, data[0]) == T_FULL && heap_pop(&heap, NULL) == T_INVALID && heap_peek(&heap, NULL) == T_INVALID, "heap full and null");
    REQUIRE(heap_build(&heap, NULL, 1) == T_INVALID && heap.count == TREE_LIMIT, "null heap input");
    const Job extremes[] = {{INT_MAX,INT_MIN},{INT_MIN,INT_MAX},{INT_MIN,INT_MIN}};
    REQUIRE(heap_build(&heap, extremes, 3) == T_OK, "heap extreme build");
    Job out; REQUIRE(heap_pop(&heap, &out) == T_OK && out.priority == INT_MIN && out.id == INT_MIN, "heap extreme comparator");
}
static size_t heap_sorts(void)
{
    size_t cases = 0, words = 1;
    for (size_t n = 0; n <= 8; n++) {
        for (size_t code = 0; code < words; code++) {
            SItem a[128], original[128]; int keys[128], seen[128] = {0}; size_t value = code;
            for (size_t i = 0; i < n; i++) { a[i] = (SItem){(int)(value % 3)-1,(int)i}; value /= 3; original[i] = a[i]; keys[i] = a[i].key; }
            qsort(keys, n, sizeof *keys, int_compare); SortStats stats;
            REQUIRE(heap_sort(a, n, &stats) == S_OK, "heap sort status");
            for (size_t i = 0; i < n; i++) {
                REQUIRE(a[i].key == keys[i] && a[i].tag >= 0 && (size_t)a[i].tag < n, "heap sort keys and identity range");
                REQUIRE(!seen[a[i].tag] && a[i].key == original[a[i].tag].key, "heap sort multiset"); seen[a[i].tag] = 1;
            }
            cases++;
        }
        words *= 3;
    }
    for (size_t trial = 0; trial < 300; trial++) {
        SItem a[128], original[128]; int keys[128], seen[128] = {0}; size_t n = random_word() % 129;
        for (size_t i = 0; i < n; i++) { a[i] = (SItem){(int)random_word()-32768,(int)i}; original[i] = a[i]; keys[i] = a[i].key; }
        if (n > 1) { a[0].key = original[0].key = keys[0] = INT_MIN; a[1].key = original[1].key = keys[1] = INT_MAX; }
        qsort(keys, n, sizeof *keys, int_compare); SortStats stats;
        REQUIRE(heap_sort(a, n, &stats) == S_OK, "random heap sort");
        for (size_t i = 0; i < n; i++) {
            REQUIRE(a[i].tag >= 0 && (size_t)a[i].tag < n, "random heap sort identity range");
            REQUIRE(a[i].key == keys[i] && !seen[a[i].tag] && a[i].key == original[a[i].tag].key, "random heap sort oracle"); seen[a[i].tag] = 1;
        }
        cases++;
    }
    SItem boundary[128], source[128]; int boundary_keys[128], seen[128] = {0}; SortStats measured;
    for (size_t i = 0; i < 128; i++) { boundary[i] = (SItem){i % 3 == 0 ? INT_MIN : i % 3 == 1 ? INT_MAX : 0,(int)i}; source[i] = boundary[i]; boundary_keys[i] = boundary[i].key; }
    qsort(boundary_keys, 128, sizeof *boundary_keys, int_compare);
    REQUIRE(heap_sort(boundary, 128, &measured) == S_OK, "maximum heap sort length");
    for (size_t i = 0; i < 128; i++) {
        REQUIRE(boundary[i].tag >= 0 && boundary[i].tag < 128, "boundary identity range");
        REQUIRE(boundary[i].key == boundary_keys[i] && !seen[boundary[i].tag] && boundary[i].key == source[boundary[i].tag].key, "maximum length multiset oracle"); seen[boundary[i].tag] = 1;
    }
    cases++;
    SItem a[] = {{2,10},{2,11},{1,12}}; SortStats stats = {777,888};
    REQUIRE(heap_sort(a, 3, &stats) == S_OK && stats.comparisons == 3 && stats.writes == 6 && a[1].tag == 11 && a[2].tag == 10, "heap sort instability and counts");
    stats = (SortStats){777,888};
    REQUIRE(heap_sort(NULL, 1, &stats) == S_INVALID && stats.writes == 888, "heap sort null");
    SItem oversized[129] = {{0,0}};
    REQUIRE(heap_sort(oversized, 129, &stats) == S_RANGE && stats.writes == 888, "heap sort oversized");
    REQUIRE(heap_sort(NULL, 0, &stats) == S_OK && stats.writes == 0, "heap sort empty");
    return cases;
}
static size_t allocation_failures(void)
{
    size_t cases = 0;
    BinaryTree tree; tree_init(&tree); const TreeToken base[] = {{1,999},{0,0},{0,0}};
    REQUIRE(tree_build(&tree, base, 3) == T_OK, "tree rollback base");
    TreeToken chain[128] = {{0,0}}; for (size_t i = 0; i < 127; i++) { chain[i] = (TreeToken){i < 63, i < 63 ? (int)i : 0}; }
    for (long fail = 0; fail < TREE_LIMIT; fail++) {
        TreeNode *old = tree.root; size_t live = s6_live; s6_fail_after(fail);
        REQUIRE(tree_build(&tree, chain, 127) == T_MEMORY, "tree construction failure");
        s6_fail_after(-1); REQUIRE(tree.root == old && tree.count == 1 && tree.root->value == 999 && s6_live == live, "tree rollback and release"); cases++;
    }
    const TreeToken bad[] = {{1,5}}, trailing[] = {{0,0},{0,0}}, flag[] = {{2,5}};
    REQUIRE(tree_build(&tree, bad, 1) == T_INVALID && tree_build(&tree, trailing, 2) == T_INVALID && tree_build(&tree, flag, 1) == T_INVALID && tree.count == 1, "bad tree syntax preserves");
    REQUIRE(tree_build(&tree, NULL, 1) == T_INVALID && tree_build(&tree, base, 0) == T_INVALID && tree_build(&tree, chain, 128) == T_FULL, "tree input budgets");
    REQUIRE(tree_build(&tree, chain, 127) == T_OK && tree_height(&tree) == 63, "deep chain boundary");
    for (int k = WALK_PRE; k <= WALK_POST_STACK; k++) { int out[63]; size_t n; REQUIRE(tree_walk(&tree, (WalkOrder)k, out, 63, &n) == T_OK && n == 63, "deep walk capacity"); }
    tree_clear(&tree);
    for (int base_n = 0; base_n < 2; base_n++) {
        BST bst; bst_init(&bst); if (base_n) { REQUIRE(bst_insert(&bst, 10) == T_OK, "BST failure base"); }
        BNode *old = bst.root; s6_fail_after(0);
        REQUIRE(bst_insert(&bst, 5) == T_MEMORY && bst.root == old && bst.count == (size_t)base_n, "BST failed insert preserves");
        s6_fail_after(-1); bst_clear(&bst); cases++;
    }
    const int rotations[4][3] = {{30,20,10},{10,20,30},{30,10,20},{10,30,20}};
    for (size_t k = 0; k < 5; k++) {
        AVL avl; avl_init(&avl); int expected[2]; size_t n = k < 4 ? 2 : 0;
        for (size_t i = 0; i < n; i++) { REQUIRE(avl_insert(&avl, rotations[k][i]) == T_OK, "AVL failure base"); expected[i] = rotations[k][i]; }
        qsort(expected, n, sizeof *expected, int_compare); ANode *old = avl.root;
        s6_fail_after(0); REQUIRE(avl_insert(&avl, k < 4 ? rotations[k][2] : 10) == T_MEMORY && avl.root == old, "AVL failure before rotations");
        s6_fail_after(-1); check_avl(&avl, expected, n); avl_clear(&avl); cases++;
    }
    REQUIRE(s6_live == 0, "all owned nodes released"); return cases;
}
int main(void)
{
    size_t shapes = tree_shapes(); search_histories(); heap_histories(); size_t sorts = heap_sorts(), failures = allocation_failures();
    printf("tree_shapes=%zu permutations=%zu bst_steps=10000 heap_steps=20000 heap_sorts=%zu allocation_failures=%zu live=%zu\n", shapes, permutations, sorts, failures, s6_live);
    return 0;
}
