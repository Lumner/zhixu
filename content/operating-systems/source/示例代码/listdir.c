#include "lab.h"
#include <dirent.h>

int main(int argc, char *argv[]) {
    if (argc > 2) { fprintf(stderr, "usage: listdir [DIRECTORY]\n"); return 2; }
    DIR *directory = opendir(argc == 2 ? argv[1] : ".");
    if (directory == NULL) { die("opendir"); }
    for (;;) {
        errno = 0;
        struct dirent *entry = readdir(directory);
        if (entry == NULL) {
            if (errno != 0) { die("readdir"); }
            break;
        }
        if (strcmp(entry->d_name, ".") != 0 && strcmp(entry->d_name, "..") != 0) {
            puts(entry->d_name);
        }
    }
    if (closedir(directory) < 0) { die("closedir"); }
    return 0;
}
