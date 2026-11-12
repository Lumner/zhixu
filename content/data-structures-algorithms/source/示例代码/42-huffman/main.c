#include "huffman.h"
#include <stdio.h>
int main(void)
{
    const HuffSymbol symbols[] = {{'A',5},{'B',7},{'C',10},{'D',15}};
    const unsigned char text[] = "ABCDDA"; Huffman tree; huff_init(&tree);
    if (huff_build(&tree, symbols, 4) != T_OK) { return 1; }
    for (size_t i = 0; i < 4; i++) {
        char code[HUFF_SYMBOLS + 1];
        if (huff_code(&tree, symbols[i].symbol, code, sizeof code) != T_OK) { return 1; }
        printf("%c=%s\n", symbols[i].symbol, code);
    }
    char bits[HUFF_BITS_MAX + 1]; unsigned char decoded[HUFF_TEXT_MAX]; size_t n, bytes;
    if (huff_encode(&tree, text, sizeof text - 1, bits, sizeof bits, &n) != T_OK || huff_decode(&tree, bits, n, decoded, sizeof decoded, &bytes) != T_OK) { return 1; }
    printf("bits=%s cost=%lu\ndecoded=", bits, huff_cost(&tree));
    if (fwrite(decoded, 1, bytes, stdout) != bytes) { return 1; }
    printf(" bytes=%zu\n", bytes); return 0;
}
