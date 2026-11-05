#ifndef OS_LAB_H
#define OS_LAB_H
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static inline void die(const char *name) {
    perror(name);
    exit(EXIT_FAILURE);
}

static inline void thread_check(int code, const char *name) {
    if (code != 0) {
        fprintf(stderr, "%s: %s\n", name, strerror(code));
        exit(EXIT_FAILURE);
    }
}

static inline void write_all(int fd, const void *data, size_t length) {
    const unsigned char *p = data;
    while (length > 0) {
        ssize_t n = write(fd, p, length);
        if (n < 0 && errno == EINTR) { continue; }
        if (n < 0) { die("write"); }
        if (n == 0) { fputs("write: no progress\n", stderr); exit(EXIT_FAILURE); }
        p += n;
        length -= (size_t)n;
    }
}

static inline int wait_child(pid_t pid) {
    int status;
    while (waitpid(pid, &status, 0) < 0) {
        if (errno != EINTR) { die("waitpid"); }
    }
    if (WIFEXITED(status)) { return WEXITSTATUS(status); }
    if (WIFSIGNALED(status)) { return 128 + WTERMSIG(status); }
    return 1;
}
#endif
