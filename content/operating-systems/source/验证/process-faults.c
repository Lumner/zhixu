/* GNU ld wrapping for bounded, owned-process tutorial tests only. */
#include "lab.h"
#include <fcntl.h>
#include <stdarg.h>

ssize_t __real_write(int, const void *, size_t);
ssize_t __real_read(int, void *, size_t);
pid_t __real_waitpid(pid_t, int *, int);
pid_t __real_fork(void);
int __real_pipe(int [2]);
int __real_dup(int);
int __real_dup2(int, int);
int __real_open(const char *, int, ...);
int __real_close(int);

static pid_t owned[8];
static int owned_count;
static int descriptors[32];
static int descriptor_count;
static int forks;
static int write_interrupted;
static int read_interrupted;
static int wait_interrupted;

static int enabled(const char *name) { return getenv(name) != NULL; }
static void track_fd(int fd) {
    if (fd > 2 && descriptor_count < 32) { descriptors[descriptor_count++] = fd; }
}
static void forget_fd(int fd) {
    for (int i = 0; i < descriptor_count; i++) {
        if (descriptors[i] == fd) { descriptors[i] = descriptors[--descriptor_count]; return; }
    }
}
ssize_t __wrap_write(int fd, const void *data, size_t size) {
    if (enabled("OS_LAB_WRITE_EINTR") && !write_interrupted++) { errno = EINTR; return -1; }
    if (enabled("OS_LAB_WRITE_ZERO")) { return 0; }
    if (enabled("OS_LAB_WRITE_ERROR")) { errno = EIO; return -1; }
    if (enabled("OS_LAB_WRITE_SHORT") && size > 2) { size = 2; }
    return __real_write(fd, data, size);
}
ssize_t __wrap_read(int fd, void *data, size_t size) {
    if (enabled("OS_LAB_READ_EINTR") && !read_interrupted++) { errno = EINTR; return -1; }
    if (enabled("OS_LAB_READ_SHORT") && size > 3) { size = 3; }
    return __real_read(fd, data, size);
}
pid_t __wrap_fork(void) {
    forks++;
    const char *at = getenv("OS_LAB_FORK_FAIL");
    if (at != NULL && forks == atoi(at)) { errno = EAGAIN; return -1; }
    pid_t pid = __real_fork();
    if (pid > 0 && owned_count < 8) { owned[owned_count++] = pid; }
    return pid;
}
pid_t __wrap_waitpid(pid_t pid, int *status, int options) {
    if (enabled("OS_LAB_WAIT_EINTR") && !wait_interrupted++) { errno = EINTR; return -1; }
    pid_t result = __real_waitpid(pid, status, options);
    if (result > 0) {
        for (int i = 0; i < owned_count; i++) {
            if (owned[i] == result) { owned[i] = owned[--owned_count]; break; }
        }
    }
    return result;
}
int __wrap_pipe(int fd[2]) {
    if (enabled("OS_LAB_PIPE_FAIL")) { errno = EMFILE; return -1; }
    int result = __real_pipe(fd);
    if (result == 0) { track_fd(fd[0]); track_fd(fd[1]); }
    return result;
}
int __wrap_dup(int fd) {
    if (enabled("OS_LAB_DUP_FAIL")) { errno = EMFILE; return -1; }
    int result = __real_dup(fd);
    if (result >= 0) { track_fd(result); }
    return result;
}
int __wrap_dup2(int oldfd, int newfd) {
    if (enabled("OS_LAB_DUP2_FAIL")) { errno = EBADF; return -1; }
    int result = __real_dup2(oldfd, newfd);
    if (result >= 0 && oldfd != newfd) { forget_fd(newfd); track_fd(result); }
    return result;
}
int __wrap_open(const char *name, int flags, ...) {
    mode_t mode = 0;
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode = (mode_t)va_arg(args, int);
        va_end(args);
    }
    if (enabled("OS_LAB_OPEN_FAIL")) { errno = EACCES; return -1; }
    int fd = __real_open(name, flags, mode);
    if (fd >= 0) { track_fd(fd); }
    return fd;
}
int __wrap_close(int fd) {
    int result = __real_close(fd);
    if (result == 0) { forget_fd(fd); }
    return result;
}
__attribute__((destructor)) static void audit(void) {
    if (enabled("OS_LAB_AUDIT") && (owned_count || descriptor_count)) {
        fprintf(stderr, "LAB_UNBALANCED children=%d descriptors=%d\n", owned_count, descriptor_count);
    }
}
