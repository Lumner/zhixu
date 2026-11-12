#include "huffman.h"
#include <string.h>
void huff_init(Huffman *tree) { *tree = (Huffman){0}; tree->root = -1; }
static int minimum(const Huffman *tree, const int *active)
{
    int best = -1;
    for (size_t i = 0; i < tree->count; i++) {
        if (active[i] && (best < 0 || tree->nodes[i].weight < tree->nodes[best].weight)) { best = (int)i; }
    }
    return best;
}
TStatus huff_build(Huffman *tree, const HuffSymbol *symbols, size_t n)
{
    if (n != 0 && symbols == NULL) { return T_INVALID; }
    if (n > HUFF_SYMBOLS) { return T_FULL; }
    for (size_t i = 0; i < n; i++) {
        if (symbols[i].weight == 0 || symbols[i].weight > 1000) { return T_INVALID; }
        for (size_t j = 0; j < i; j++) { if (symbols[j].symbol == symbols[i].symbol) { return T_DUPLICATE; } }
    }
    Huffman next; huff_init(&next); int active[HUFF_NODES] = {0};
    next.symbols = next.count = n;
    for (size_t i = 0; i < n; i++) { next.nodes[i] = (HuffNode){symbols[i].weight,-1,-1,-1,symbols[i].symbol}; active[i] = 1; }
    for (size_t remaining = n; remaining > 1; remaining--) {
        int left = minimum(&next, active); active[left] = 0;
        int right = minimum(&next, active); active[right] = 0;
        int parent = (int)next.count++;
        next.nodes[parent] = (HuffNode){next.nodes[left].weight + next.nodes[right].weight,left,right,-1,0};
        next.nodes[left].parent = next.nodes[right].parent = parent; active[parent] = 1;
    }
    next.root = n == 0 ? -1 : (int)next.count - 1;
    *tree = next; return T_OK;
}
static size_t code_at(const Huffman *tree, int leaf, char *code)
{
    if (tree->symbols == 1) { code[0] = '0'; code[1] = '\0'; return 1; }
    char reverse[HUFF_SYMBOLS]; size_t n = 0;
    while (tree->nodes[leaf].parent >= 0) {
        int parent = tree->nodes[leaf].parent;
        reverse[n++] = tree->nodes[parent].left == leaf ? '0' : '1'; leaf = parent;
    }
    for (size_t i = 0; i < n; i++) { code[i] = reverse[n - 1 - i]; }
    code[n] = '\0'; return n;
}
TStatus huff_code(const Huffman *tree, unsigned char symbol, char *out, size_t capacity)
{
    if (out == NULL) { return T_INVALID; }
    for (size_t i = 0; i < tree->symbols; i++) {
        if (tree->nodes[i].symbol == symbol) {
            char code[HUFF_SYMBOLS + 1]; size_t n = code_at(tree, (int)i, code);
            if (capacity <= n) { return T_SPACE; }
            memcpy(out, code, n + 1); return T_OK;
        }
    }
    return T_MISSING;
}
TStatus huff_encode(const Huffman *tree, const unsigned char *text, size_t n, char *out, size_t capacity, size_t *bits)
{
    if (out == NULL || bits == NULL || (n != 0 && text == NULL)) { return T_INVALID; }
    if (n > HUFF_TEXT_MAX) { return T_FULL; }
    char candidate[HUFF_BITS_MAX + 1]; size_t used = 0;
    for (size_t i = 0; i < n; i++) {
        char code[HUFF_SYMBOLS + 1];
        if (huff_code(tree, text[i], code, sizeof code) != T_OK) { return T_INVALID; }
        for (size_t j = 0; code[j] != '\0'; j++) { candidate[used++] = code[j]; }
    }
    if (capacity <= used) { return T_SPACE; }
    candidate[used] = '\0'; memcpy(out, candidate, used + 1); *bits = used; return T_OK;
}
TStatus huff_decode(const Huffman *tree, const char *bits, size_t n, unsigned char *out, size_t capacity, size_t *bytes)
{
    if (bytes == NULL || (n != 0 && bits == NULL) || (capacity != 0 && out == NULL)) { return T_INVALID; }
    if (n > HUFF_BITS_MAX) { return T_FULL; }
    unsigned char candidate[HUFF_TEXT_MAX]; size_t used = 0;
    if (tree->root < 0) { if (n != 0) { return T_INVALID; } }
    else {
        int cursor = tree->root;
        for (size_t i = 0; i < n; i++) {
            if (bits[i] != '0' && bits[i] != '1') { return T_INVALID; }
            if (tree->symbols == 1) { if (bits[i] != '0') { return T_INVALID; } }
            else { cursor = bits[i] == '0' ? tree->nodes[cursor].left : tree->nodes[cursor].right; }
            if (tree->nodes[cursor].left < 0) {
                if (used == HUFF_TEXT_MAX) { return T_FULL; }
                candidate[used++] = tree->nodes[cursor].symbol; cursor = tree->root;
            }
        }
        if (cursor != tree->root) { return T_INVALID; }
    }
    if (capacity < used) { return T_SPACE; }
    if (used != 0) { memcpy(out, candidate, used); }
    *bytes = used; return T_OK;
}
unsigned long huff_cost(const Huffman *tree)
{
    unsigned long total = 0;
    for (size_t i = 0; i < tree->symbols; i++) {
        char code[HUFF_SYMBOLS + 1]; size_t n = code_at(tree, (int)i, code);
        total += (unsigned long)tree->nodes[i].weight * n;
    }
    return total;
}
