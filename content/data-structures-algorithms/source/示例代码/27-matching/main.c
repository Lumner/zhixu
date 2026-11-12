#include "matching.h"
#include <stdio.h>
#include <string.h>
int main(int argc, char **argv)
{
    if (argc != 1 && argc != 3) {
        fputs("usage: matching [text pattern]\n", stderr);
        return 1;
    }
    const char *text = argc == 3 ? argv[1] : "ababababac";
    const char *pattern = argc == 3 ? argv[2] : "ababac";
    size_t n = strlen(text), m = strlen(pattern);
    Match a, b;
    size_t pi[MATCH_PATTERN_MAX];
    if (naive_match(text, n, pattern, m, &a) != M_OK ||
        kmp_match(text, n, pattern, m, &b) != M_OK ||
        prefix_build(pattern, m, pi, MATCH_PATTERN_MAX) != M_OK) {
        fputs("matching: invalid or length\n", stderr);
        return 1;
    }
    printf("pi=");
    for (size_t i = 0; i < m; i++) {
        printf("%s%zu", i == 0 ? "" : ",", pi[i]);
    }
    printf("\nnaive found=%d index=%zu\nkmp found=%d index=%zu\n", a.found, a.index, b.found, b.index);
    return 0;
}
