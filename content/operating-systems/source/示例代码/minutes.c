#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <ctype.h>
#include <string.h>

int main(void) {
    char line[64];
    char *end;
    printf("Minutes (0..10080): ");
    if (fgets(line, sizeof line, stdin) == NULL) {
        fprintf(stderr, "No input\n");
        return 1;
    }
    if (strchr(line, '\n') == NULL && !feof(stdin)) {
        fprintf(stderr, "Input too long\n");
        return 1;
    }
    errno = 0;
    long minutes = strtol(line, &end, 10);
    if (end == line || errno == ERANGE) {
        fprintf(stderr, "Invalid integer\n");
        return 1;
    }
    while (isspace((unsigned char)*end)) { end++; }
    if (*end != '\0' || minutes < 0 || minutes > 10080) {
        fprintf(stderr, "Expected 0..10080\n");
        return 1;
    }
    printf("%ld h %ld min\n", minutes / 60, minutes % 60);
    return 0;
}
