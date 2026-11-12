#include <stdint.h>
#include <stdio.h>

int main(int argc, char *argv[])
{
    if (argc != 2) {
        fputs("usage: file_count input-file\n", stderr);
        return 1;
    }
    FILE *in = fopen(argv[1], "rb");
    if (in == NULL) {
        fputs("open failed\n", stderr);
        return 1;
    }
    size_t count = 0;
    int ch;
    while ((ch = fgetc(in)) != EOF) {
        if (count == SIZE_MAX) {
            fclose(in);
            fputs("file too large\n", stderr);
            return 1;
        }
        count++;
    }
    int failed = ferror(in) != 0;
    if (fclose(in) != 0) {
        failed = 1;
    }
    if (failed) {
        fputs("read or close failed\n", stderr);
        return 1;
    }
    printf("bytes=%zu\n", count);
    return 0;
}
