#include "lab.h"
#include <sys/socket.h>

int main(void) {
    int fd[2];
    if (socketpair(AF_UNIX, SOCK_STREAM, 0, fd) < 0) { die("socketpair"); }
    const char text[] = "local socket bytes\n";
    write_all(fd[0], text, sizeof text - 1);
    if (shutdown(fd[0], SHUT_WR) < 0) { die("shutdown"); }
    char buffer[8];
    for (;;) {
        ssize_t n = read(fd[1], buffer, sizeof buffer);
        if (n < 0 && errno == EINTR) { continue; }
        if (n < 0) { die("read"); }
        if (n == 0) { break; }
        write_all(STDOUT_FILENO, buffer, (size_t)n);
    }
    close(fd[0]);
    close(fd[1]);
    return 0;
}
