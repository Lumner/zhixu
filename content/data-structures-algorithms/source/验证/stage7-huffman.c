#include "stage6-test.h"
#include "huffman.h"
#include <limits.h>
#include <string.h>
static unsigned long optimal_cost(const HuffSymbol *symbols, size_t n)
{
    unsigned long dp[256] = {0}, sum[256] = {0}; unsigned int states = 1U << n;
    for (unsigned int mask = 1; mask < states; mask++) {
        unsigned int count = 0;
        for (size_t i = 0; i < n; i++) { if (mask & (1U << i)) { sum[mask] += symbols[i].weight; count++; } }
        if (count <= 1) { continue; }
        dp[mask] = ULONG_MAX;
        for (unsigned int part = 1; part < mask; part++) {
            if ((part & mask) != part) { continue; }
            unsigned int other = mask ^ part;
            unsigned long candidate = dp[part] + dp[other] + sum[mask];
            if (candidate < dp[mask]) { dp[mask] = candidate; }
        }
    }
    return dp[states - 1];
}
static void inspect(const Huffman *tree)
{
    REQUIRE(tree->symbols <= 8 && tree->count == (tree->symbols == 0 ? 0 : 2 * tree->symbols - 1), "Huffman node counts");
    if (tree->symbols == 0) { REQUIRE(tree->root == -1, "empty root"); return; }
    REQUIRE(tree->root == (int)tree->count - 1 && tree->nodes[tree->root].parent == -1, "root parent");
    char codes[8][9];
    for (size_t i = 0; i < tree->symbols; i++) {
        REQUIRE(tree->nodes[i].left == -1 && tree->nodes[i].right == -1, "leaf representation");
        REQUIRE(huff_code(tree, tree->nodes[i].symbol, codes[i], 9) == T_OK && strlen(codes[i]) >= 1 && strlen(codes[i]) <= 7, "code length budget");
        for (size_t j = 0; j < i; j++) {
            size_t a = strlen(codes[i]), b = strlen(codes[j]), common = a < b ? a : b;
            REQUIRE(memcmp(codes[i], codes[j], common) != 0, "prefix free codebook");
        }
    }
    for (size_t i = tree->symbols; i < tree->count; i++) {
        int left = tree->nodes[i].left, right = tree->nodes[i].right;
        REQUIRE(left >= 0 && right >= 0 && left < (int)i && right < (int)i && left != right, "internal child indexes");
        REQUIRE(tree->nodes[left].parent == (int)i && tree->nodes[right].parent == (int)i, "parent child consistency");
        REQUIRE(tree->nodes[i].weight == tree->nodes[left].weight + tree->nodes[right].weight, "parent weight sum");
    }
}
static size_t frequency_cases(void)
{
    size_t cases = 0, choices = 1;
    for (size_t n = 0; n <= 5; n++) {
        for (size_t code = 0; code < choices; code++) {
            HuffSymbol symbols[8]; size_t value = code;
            for (size_t i = 0; i < n; i++) { symbols[i] = (HuffSymbol){(unsigned char)(i * 31), (unsigned int)(value % 3) + 1}; value /= 3; }
            Huffman tree; huff_init(&tree);
            REQUIRE(huff_build(&tree, symbols, n) == T_OK, "frequency build"); inspect(&tree);
            unsigned long expected = n == 1 ? symbols[0].weight : optimal_cost(symbols, n);
            REQUIRE(huff_cost(&tree) == expected, "independent subset optimum"); cases++;
        }
        choices *= 3;
    }
    return cases;
}
static size_t message_cases(void)
{
    const HuffSymbol symbols[] = {{0,1},{'A',2},{'B',3},{255,5}}; Huffman tree; huff_init(&tree);
    REQUIRE(huff_build(&tree, symbols, 4) == T_OK, "binary message book");
    size_t cases = 0, choices = 1;
    for (size_t n = 0; n <= 6; n++) {
        for (size_t code = 0; code < choices; code++) {
            unsigned char text[64], decoded[64]; char bits[449]; size_t value = code, used = 999, bytes = 999;
            for (size_t i = 0; i < n; i++) { text[i] = symbols[value % 4].symbol; value /= 4; }
            REQUIRE(huff_encode(&tree, text, n, bits, sizeof bits, &used) == T_OK && strlen(bits) == used, "encode explicit bytes");
            REQUIRE(huff_decode(&tree, bits, used, decoded, sizeof decoded, &bytes) == T_OK && bytes == n && memcmp(text, decoded, n) == 0, "roundtrip binary oracle"); cases++;
        }
        choices *= 4;
    }
    unsigned char text[64], decoded[64]; memset(text, 0, 64); char bits[449]; size_t used, bytes;
    REQUIRE(huff_encode(&tree, text, 64, bits, 449, &used) == T_OK && huff_decode(&tree, bits, used, decoded, 64, &bytes) == T_OK && bytes == 64 && memcmp(text, decoded, 64) == 0, "maximum message");
    return cases;
}
static size_t bit_cases(void)
{
    const HuffSymbol symbols[] = {{'A',5},{'B',7},{'C',10},{'D',15}}; Huffman tree; huff_init(&tree);
    REQUIRE(huff_build(&tree, symbols, 4) == T_OK, "decoder book");
    char codes[4][9]; for (size_t i = 0; i < 4; i++) { REQUIRE(huff_code(&tree, symbols[i].symbol, codes[i], 9) == T_OK, "decoder codebook"); }
    size_t cases = 0;
    for (size_t n = 0; n <= 9; n++) {
        for (unsigned int code = 0; code < (1U << n); code++) {
            char bits[10]; unsigned int value = code;
            for (size_t i = 0; i < n; i++) { bits[i] = value % 2 ? '1' : '0'; value /= 2; }
            size_t position = 0, count = 0; unsigned char expected[64];
            while (position < n) {
                int found = 0;
                for (size_t j = 0; j < 4; j++) {
                    size_t length = strlen(codes[j]);
                    if (length <= n - position && memcmp(bits + position, codes[j], length) == 0) {
                        expected[count++] = symbols[j].symbol; position += length; found = 1; break;
                    }
                }
                if (!found) { break; }
            }
            unsigned char decoded[64] = {222}; size_t bytes = 999;
            TStatus status = huff_decode(&tree, bits, n, decoded, 64, &bytes);
            if (position == n) { REQUIRE(status == T_OK && bytes == count && memcmp(decoded, expected, count) == 0, "dictionary parse oracle"); }
            else { REQUIRE(status == T_INVALID && decoded[0] == 222 && bytes == 999, "truncated prefix rejected"); }
            cases++;
        }
    }
    return cases;
}
static void boundaries(void)
{
    Huffman tree; huff_init(&tree); const HuffSymbol one[] = {{0,1000}};
    REQUIRE(huff_build(&tree, one, 1) == T_OK && huff_cost(&tree) == 1000, "single symbol bit convention");
    char code[9]; REQUIRE(huff_code(&tree, 0, code, 9) == T_OK && strcmp(code, "0") == 0, "single code zero");
    unsigned char out[64] = {222}; size_t bytes = 999;
    REQUIRE(huff_decode(&tree, "000", 3, out, 64, &bytes) == T_OK && bytes == 3 && out[0] == 0 && out[2] == 0, "single binary decode");
    out[0] = 222; bytes = 999;
    REQUIRE(huff_decode(&tree, "1", 1, out, 64, &bytes) == T_INVALID && out[0] == 222 && bytes == 999, "single rejects one");
    char long_bits[449]; memset(long_bits, '0', sizeof long_bits);
    REQUIRE(huff_decode(&tree, long_bits, 65, out, 64, &bytes) == T_FULL && out[0] == 222, "decoded output budget");
    REQUIRE(huff_decode(&tree, long_bits, 449, out, 64, &bytes) == T_FULL && bytes == 999, "bit input budget");
    unsigned char text[65] = {0}; char encoded[449] = "unchanged"; size_t count = 999;
    REQUIRE(huff_encode(&tree, text, 65, encoded, 449, &count) == T_FULL && strcmp(encoded, "unchanged") == 0 && count == 999, "message budget preserves");
    REQUIRE(huff_encode(&tree, text, 2, encoded, 2, &count) == T_SPACE && count == 999 && strcmp(encoded, "unchanged") == 0, "encode terminator capacity");
    REQUIRE(huff_decode(&tree, "00", 2, out, 1, &bytes) == T_SPACE && out[0] == 222 && bytes == 999, "decode capacity preserves");
    REQUIRE(huff_decode(&tree, "02", 2, out, 64, &bytes) == T_INVALID && out[0] == 222 && bytes == 999, "non bit rejected");
    text[0] = 'Z'; REQUIRE(huff_encode(&tree, text, 1, encoded, 449, &count) == T_INVALID && strcmp(encoded, "unchanged") == 0, "unknown symbol preserves");
    Huffman old; memcpy(&old, &tree, sizeof tree);
    const HuffSymbol duplicate[] = {{'A',1},{'A',2}}, zero[] = {{'A',0}}, high[] = {{'A',1001}};
    REQUIRE(huff_build(&tree, duplicate, 2) == T_DUPLICATE && memcmp(&tree, &old, sizeof tree) == 0, "duplicate book preserves");
    REQUIRE(huff_build(&tree, zero, 1) == T_INVALID && huff_build(&tree, high, 1) == T_INVALID && memcmp(&tree, &old, sizeof tree) == 0, "bad weights preserve");
    HuffSymbol many[9]; for (size_t i = 0; i < 9; i++) { many[i] = (HuffSymbol){(unsigned char)i,1000}; }
    REQUIRE(huff_build(&tree, many, 9) == T_FULL && huff_build(&tree, NULL, 1) == T_INVALID, "book input limits");
    REQUIRE(huff_build(&tree, many, 8) == T_OK && tree.nodes[tree.root].weight == 8000, "maximum weight sum"); inspect(&tree);
    const HuffSymbol deep[] = {{0,1},{1,1},{2,2},{3,3},{4,5},{5,8},{6,13},{7,21}};
    REQUIRE(huff_build(&tree, deep, 8) == T_OK, "deep codebook"); inspect(&tree);
    memset(text, 0, 64);
    REQUIRE(huff_encode(&tree, text, 64, encoded, 449, &count) == T_OK && count == 448, "maximum valid bit length");
    REQUIRE(huff_decode(&tree, encoded, count, out, 64, &bytes) == T_OK && bytes == 64 && memcmp(out, text, 64) == 0, "maximum bit length decode");
    code[0] = 'x'; REQUIRE(huff_code(&tree, 0, code, 1) == T_SPACE && code[0] == 'x', "code capacity preserves");
    REQUIRE(huff_code(&tree, 99, code, 9) == T_MISSING && code[0] == 'x', "missing code");
    REQUIRE(huff_code(&tree, 0, NULL, 9) == T_INVALID && huff_encode(&tree, text, 1, NULL, 9, &count) == T_INVALID, "null code outputs");
    REQUIRE(huff_encode(&tree, NULL, 1, encoded, 449, &count) == T_INVALID && huff_encode(&tree, text, 1, encoded, 449, NULL) == T_INVALID, "null encode inputs");
    REQUIRE(huff_decode(&tree, NULL, 1, out, 64, &bytes) == T_INVALID && huff_decode(&tree, "", 0, NULL, 1, &bytes) == T_INVALID && huff_decode(&tree, "", 0, out, 64, NULL) == T_INVALID, "null decode inputs");
    REQUIRE(huff_build(&tree, NULL, 0) == T_OK && huff_cost(&tree) == 0, "empty book");
    REQUIRE(huff_encode(&tree, NULL, 0, encoded, 449, &count) == T_OK && count == 0 && encoded[0] == '\0', "empty encode");
    REQUIRE(huff_decode(&tree, NULL, 0, NULL, 0, &bytes) == T_OK && bytes == 0, "empty decode");
    REQUIRE(huff_decode(&tree, "0", 1, out, 64, &bytes) == T_INVALID, "empty book nonempty bits");
}
int main(void)
{
    size_t frequencies = frequency_cases(), messages = message_cases(), bits = bit_cases(); boundaries();
    printf("frequency_sets=%zu binary_messages=%zu bit_strings=%zu\n", frequencies, messages, bits); return 0;
}
