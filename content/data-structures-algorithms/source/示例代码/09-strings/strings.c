#include <stdio.h>
#include <string.h>

int main(void)
{
    char title[16];
    if (fgets(title, sizeof title, stdin) == NULL) {
        puts("missing input");
        return 1;
    }
    size_t length = strlen(title);
    if (length > 0 && title[length - 1] == '\n') {
        title[--length] = '\0';
    } else if (length == sizeof title - 1) {
        int ch = getchar();
        if (ch != '\n' && ch != EOF) {
            while (ch != '\n' && ch != EOF) {
                ch = getchar();
            }
            puts("too long");
            return 1;
        }
    }
    if (length == 0) {
        puts("empty title");
        return 1;
    }
    printf("title=%s\nbytes=%zu\n", title, length);
    printf("same=%d\n", strcmp(title, "C basics") == 0);
    return 0;
}
