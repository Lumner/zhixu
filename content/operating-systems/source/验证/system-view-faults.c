/* Faults apply only to programs linked explicitly with --wrap in this course. */
#include <errno.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/utsname.h>
#include <unistd.h>

static unsigned char owned[4096];
static int mode(const char *name) {
    const char *value = getenv("VIEW_FAULT");
    return value != NULL && strcmp(value, name) == 0;
}
static int fail(const char *name, int number) {
    char value[80];
    snprintf(value, sizeof value, "%s:%d", name, number);
    if (mode(value)) { errno = EIO; return 1; }
    return 0;
}
static void remember(int fd) {
    if (fd >= 0 && fd < (int)sizeof owned) { owned[fd] = 1; }
}
__attribute__((destructor)) static void audit(void) {
    for (size_t i = 0; i < sizeof owned; ++i) {
        if (owned[i]) { fprintf(stderr, "LAB_LIVE_FD=%zu\n", i); }
    }
}
int __real_open(const char *, int, ...);
int __wrap_open(const char *name, int flags, ...) {
    static int calls;
    if (fail("open", ++calls)) { return -1; }
    int fd;
    if (flags & O_CREAT) {
        va_list args; va_start(args, flags); mode_t value = va_arg(args, mode_t); va_end(args);
        fd = __real_open(name, flags, value);
    } else { fd = __real_open(name, flags); }
    remember(fd); return fd;
}
int __real_openat(int, const char *, int, ...);
int __wrap_openat(int dir, const char *name, int flags, ...) {
    static int calls;
    if (fail("openat", ++calls)) { return -1; }
    int fd = __real_openat(dir, name, flags);
    remember(fd); return fd;
}
int __real_close(int);
int __wrap_close(int fd) {
    static int calls;
    int injected = fail("close", ++calls);
    int result = __real_close(fd);
    if (fd >= 0 && fd < (int)sizeof owned) { owned[fd] = 0; }
    if (injected) { errno = EIO; return -1; }
    return result;
}
int __real_fstat(int, struct stat *);
int __wrap_fstat(int fd, struct stat *info) {
    static int calls;
    if (fail("fstat", ++calls)) { return -1; }
    return __real_fstat(fd, info);
}
ssize_t __real_read(int, void *, size_t);
ssize_t __wrap_read(int fd, void *data, size_t length) {
    static int calls; ++calls;
    if (fail("read", calls)) { return -1; }
    if (calls == 1 && mode("read-eintr")) { errno = EINTR; return -1; }
    if (mode("read-short") && length > 1) { length = 1; }
    return __real_read(fd, data, length);
}
ssize_t __real_write(int, const void *, size_t);
ssize_t __wrap_write(int fd, const void *data, size_t length) {
    static int calls; ++calls;
    if (fail("write", calls)) { return -1; }
    if (calls == 1 && mode("write-eintr")) { errno = EINTR; return -1; }
    if (calls == 1 && mode("write-zero")) { return 0; }
    if (mode("write-short") && length > 1) { length = 1; }
    return __real_write(fd, data, length);
}
int __real_socket(int, int, int);
int __wrap_socket(int domain, int type, int protocol) {
    static int calls;
    if (fail("socket", ++calls)) { return -1; }
    int fd = __real_socket(domain, type, protocol); remember(fd); return fd;
}
int __real_socketpair(int, int, int, int[2]);
int __wrap_socketpair(int domain, int type, int protocol, int sv[2]) {
    static int calls;
    if (fail("socketpair", ++calls)) { return -1; }
    int result = __real_socketpair(domain, type, protocol, sv);
    if (result == 0) { remember(sv[0]); remember(sv[1]); }
    return result;
}
int __real_bind(int, const struct sockaddr *, socklen_t);
int __wrap_bind(int fd, const struct sockaddr *a, socklen_t n) {
    static int calls;
    if (fail("bind", ++calls)) { return -1; }
    return __real_bind(fd, a, n);
}
int __real_listen(int, int);
int __wrap_listen(int fd, int backlog) {
    static int calls;
    if (fail("listen", ++calls)) { return -1; }
    return __real_listen(fd, backlog);
}
int __real_getsockname(int, struct sockaddr *, socklen_t *);
int __wrap_getsockname(int fd, struct sockaddr *a, socklen_t *n) {
    static int calls;
    if (fail("getsockname", ++calls)) { return -1; }
    int result = __real_getsockname(fd, a, n);
    if (mode("address-short")) { *n = 1; }
    return result;
}
int __real_setsockopt(int, int, int, const void *, socklen_t);
int __wrap_setsockopt(int fd, int level, int option, const void *v, socklen_t n) {
    static int calls;
    if (fail("setsockopt", ++calls)) { return -1; }
    return __real_setsockopt(fd, level, option, v, n);
}
int __real_connect(int, const struct sockaddr *, socklen_t);
int __wrap_connect(int fd, const struct sockaddr *a, socklen_t n) {
    static int calls;
    if (fail("connect", ++calls)) { return -1; }
    return __real_connect(fd, a, n);
}
int __real_accept(int, struct sockaddr *, socklen_t *);
int __wrap_accept(int fd, struct sockaddr *a, socklen_t *n) {
    static int calls; ++calls;
    if (fail("accept", calls)) { return -1; }
    if (calls == 1 && mode("accept-eintr")) { errno = EINTR; return -1; }
    int result = __real_accept(fd, a, n); remember(result); return result;
}
ssize_t __real_send(int, const void *, size_t, int);
ssize_t __wrap_send(int fd, const void *data, size_t n, int flags) {
    static int calls; ++calls;
    if (fail("send", calls)) { return -1; }
    if (calls == 1 && mode("send-eintr")) { errno = EINTR; return -1; }
    if (calls == 1 && mode("send-zero")) { return 0; }
    if (mode("send-short") && n > 1) { n = 1; }
    return __real_send(fd, data, n, flags);
}
ssize_t __real_recv(int, void *, size_t, int);
ssize_t __wrap_recv(int fd, void *data, size_t n, int flags) {
    static int calls; ++calls;
    if (fail("recv", calls)) { return -1; }
    if (calls == 1 && mode("recv-eintr")) { errno = EINTR; return -1; }
    if (calls == 1 && mode("recv-zero")) { return 0; }
    if (mode("recv-short") && n > 1) { n = 1; }
    return __real_recv(fd, data, n, flags);
}
int __real_shutdown(int, int);
int __wrap_shutdown(int fd, int how) {
    static int calls;
    if (fail("shutdown", ++calls)) { return -1; }
    return __real_shutdown(fd, how);
}
pid_t __real_fork(void);
pid_t __wrap_fork(void) {
    static int calls;
    if (fail("fork", ++calls)) { return -1; }
    return __real_fork();
}
ssize_t __real_readlink(const char *, char *, size_t);
ssize_t __wrap_readlink(const char *path, char *data, size_t n) {
    static int calls;
    if (fail("readlink", ++calls)) { return -1; }
    if (mode("link-full")) { memset(data, 'x', n); return (ssize_t)n; }
    return __real_readlink(path, data, n);
}
int __real_getrlimit(int, struct rlimit *);
int __wrap_getrlimit(int resource, struct rlimit *value) {
    static int calls;
    if (fail("getrlimit", ++calls)) { return -1; }
    return __real_getrlimit(resource, value);
}
int __real_uname(struct utsname *);
int __wrap_uname(struct utsname *value) {
    static int calls;
    if (fail("uname", ++calls)) { return -1; }
    return __real_uname(value);
}
int __real_fflush(FILE *);
int __wrap_fflush(FILE *file) {
    static int calls;
    int result = __real_fflush(file);
    if (fail("fflush", ++calls)) { return EOF; }
    return result;
}
