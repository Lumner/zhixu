#include <stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "usage: copy INPUT NEW_OUTPUT\n");
        return 2;
    }
    FILE *in = fopen(argv[1], "rb");
    if (in == NULL) { perror("input"); return 1; }
    FILE *out = fopen(argv[2], "wbx");
    if (out == NULL) { perror("new output"); fclose(in); return 1; }
    unsigned char buffer[4096];
    size_t n;
    int failed = 0;
    while ((n = fread(buffer, 1, sizeof buffer, in)) > 0) {
        if (fwrite(buffer, 1, n, out) != n) { failed = 1; break; }
    }
    if (ferror(in)) { failed = 1; }
    if (fclose(in) != 0) { failed = 1; }
    if (fclose(out) != 0) { failed = 1; }
    if (failed) { fprintf(stderr, "Copy failed; output may be partial\n"); }
    return failed;
}
