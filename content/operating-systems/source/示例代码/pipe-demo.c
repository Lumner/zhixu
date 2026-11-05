#include "lab.h"

int main(void) {
    int fd[2];
    if (pipe(fd) < 0) { die("pipe"); }
    pid_t pid = fork();
    if (pid < 0) { die("fork"); }
    if (pid == 0) {
        close(fd[0]);
        const char text[] = "hello through pipe\n";
        write_all(fd[1], text, sizeof text - 1);
        close(fd[1]);
        _exit(0);
    }
    close(fd[1]);
    char buffer[16];
    for (;;) {
        ssize_t n = read(fd[0], buffer, sizeof buffer);
        if (n < 0 && errno == EINTR) { continue; }
        if (n < 0) { die("read"); }
        if (n == 0) { break; }
        write_all(STDOUT_FILENO, buffer, (size_t)n);
    }
    close(fd[0]);
    return wait_child(pid);
}
