#include "lab.h"

int main(void) {
    const char text[] = "write reaches fd 1\n";
    write_all(STDOUT_FILENO, text, sizeof text - 1);
    return 0;
}
