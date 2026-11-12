#ifndef DSA_HUFFMAN_H
#define DSA_HUFFMAN_H
#include "tree_status.h"
#define HUFF_SYMBOLS 8
#define HUFF_NODES (2 * HUFF_SYMBOLS - 1)
#define HUFF_TEXT_MAX 64
#define HUFF_BITS_MAX (HUFF_TEXT_MAX * (HUFF_SYMBOLS - 1))
typedef struct { unsigned char symbol; unsigned int weight; } HuffSymbol;
typedef struct { unsigned int weight; int left; int right; int parent; unsigned char symbol; } HuffNode;
typedef struct { HuffNode nodes[HUFF_NODES]; size_t symbols; size_t count; int root; } Huffman;
void huff_init(Huffman *tree);
TStatus huff_build(Huffman *tree, const HuffSymbol *symbols, size_t n);
TStatus huff_code(const Huffman *tree, unsigned char symbol, char *out, size_t capacity);
TStatus huff_encode(const Huffman *tree, const unsigned char *text, size_t n, char *out, size_t capacity, size_t *bits);
TStatus huff_decode(const Huffman *tree, const char *bits, size_t n, unsigned char *out, size_t capacity, size_t *bytes);
unsigned long huff_cost(const Huffman *tree);
#endif
