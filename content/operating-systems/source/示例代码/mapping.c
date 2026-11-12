#include "lab.h"
#include <sys/mman.h>

int main(void) {
    FILE *file = tmpfile();
    if (file == NULL) { die("tmpfile"); }
    int fd = fileno(file);
    if (fd < 0) { die("fileno"); }
    if (fflush(file) != 0) { die("fflush"); }
    write_all(fd, "abc", 3);
    char *memory = mmap(NULL, 3, PROT_READ | PROT_WRITE, MAP_PRIVATE, fd, 0);
    if (memory == MAP_FAILED) { die("mmap"); }
    memory[0] = 'X';
    char original;
    if (pread(fd, &original, 1, 0) != 1) { die("pread"); }
    printf("mapping=%c file=%c\n", memory[0], original);
    if (munmap(memory, 3) < 0) { die("munmap"); }
    if (fclose(file) != 0) { die("fclose"); }
    return 0;
}
