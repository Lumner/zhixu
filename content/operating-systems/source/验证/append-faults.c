/* Explicitly linked wrappers for this extension's private tests. */
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static int fds[64], fd_count, child_count;
static pid_t children[16];
static int mode(const char *name) {
    const char *value = getenv("APPEND_FAULT");
    return value != NULL && strcmp(value, name) == 0;
}
static int fail(const char *name, int count) {
    char value[64];
    snprintf(value, sizeof value, "%s:%d", name, count);
    if (mode(value)) { errno = EIO; return 1; }
    return 0;
}
static void track(int fd) { if (fd > 2 && fd_count < 64) { fds[fd_count++] = fd; } }
static void forget(int fd) {
    for (int i = 0; i < fd_count; ++i) {
        if (fds[i] == fd) { fds[i] = fds[--fd_count]; return; }
    }
}
__attribute__((destructor)) static void audit(void) {
    if (fd_count || child_count) { fprintf(stderr, "LAB_UNBALANCED fds=%d children=%d\n", fd_count, child_count); }
}
int __real_open(const char *, int, ...);
int __wrap_open(const char *name, int flags, ...) {
    static int count;
    if (fail("open", ++count)) { return -1; }
    mode_t permissions = 0;
    if (flags & O_CREAT) {
        va_list args; va_start(args, flags); permissions = va_arg(args, mode_t); va_end(args);
    }
    if (getenv("APPEND_TRACE_OPEN")) {
        fprintf(stderr, "LAB_OPEN append=%d trunc=%d\n", !!(flags & O_APPEND), !!(flags & O_TRUNC));
    }
    int fd = __real_open(name, flags, permissions); track(fd); return fd;
}
int __real_close(int);
int __wrap_close(int fd) {
    static int count;
    int injected = fail("close", ++count);
    int result = __real_close(fd); forget(fd);
    if (injected) { errno = EIO; return -1; }
    return result;
}
ssize_t __real_write(int, const void *, size_t);
ssize_t __wrap_write(int fd, const void *data, size_t length) {
    static int count; ++count;
    if (fail("write", count)) { return -1; }
    if (count == 1 && mode("write-eintr")) { errno = EINTR; return -1; }
    if (count == 1 && mode("write-zero")) { return 0; }
    return __real_write(fd, data, length);
}
off_t __real_lseek(int, off_t, int);
off_t __wrap_lseek(int fd, off_t offset, int whence) {
    static int count;
    if (fail("lseek", ++count)) { return (off_t)-1; }
    return __real_lseek(fd, offset, whence);
}
int __real_fflush(FILE *);
int __wrap_fflush(FILE *stream) {
    static int count;
    int result = __real_fflush(stream);
    if (fail("fflush", ++count)) { return EOF; }
    return result;
}
int __real_pipe(int [2]);
int __wrap_pipe(int values[2]) {
    static int count;
    if (fail("pipe", ++count)) { return -1; }
    int result = __real_pipe(values);
    if (result == 0) { track(values[0]); track(values[1]); }
    return result;
}
pid_t __real_fork(void);
pid_t __wrap_fork(void) {
    static int count;
    if (fail("fork", ++count)) { return -1; }
    pid_t pid = __real_fork();
    if (pid > 0 && child_count < 16) { children[child_count++] = pid; }
    return pid;
}
pid_t __real_waitpid(pid_t, int *, int);
pid_t __wrap_waitpid(pid_t pid, int *status, int options) {
    static int interrupted;
    if (mode("wait-eintr") && !interrupted++) { errno = EINTR; return -1; }
    pid_t result = __real_waitpid(pid, status, options);
    if (result > 0) {
        for (int i = 0; i < child_count; ++i) {
            if (children[i] == result) { children[i] = children[--child_count]; break; }
        }
    }
    return result;
}
int __real_dup2(int, int);
int __wrap_dup2(int oldfd, int newfd) {
    static int count;
    if (fail("dup2", ++count)) { return -1; }
    return __real_dup2(oldfd, newfd);
}
