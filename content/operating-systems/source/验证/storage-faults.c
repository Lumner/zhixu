/* Temporary Linux test binaries only; no system limits or user files altered. */
#define _DEFAULT_SOURCE
#include "lab.h"
#include <dirent.h>
#include <fcntl.h>
#include <poll.h>
#include <stdarg.h>
#include <sys/stat.h>

int __real_open(const char *, int, ...);
int __real_openat(int, const char *, int, ...);
int __real_close(int);
int __real_dup(int);
int __real_pipe(int [2]);
int __real_fstat(int, struct stat *);
int __real_fstatat(int, const char *, struct stat *, int);
ssize_t __real_write(int, const void *, size_t);
ssize_t __real_read(int, void *, size_t);
DIR *__real_opendir(const char *);
struct dirent *__real_readdir(DIR *);
int __real_closedir(DIR *);
int __real_dirfd(DIR *);
FILE *__real_fopen(const char *, const char *);
size_t __real_fwrite(const void *, size_t, size_t, FILE *);
int __real_fputc(int, FILE *);
int __real_fflush(FILE *);
int __real_fclose(FILE *);
int __real_fileno(FILE *);
int __real_fsync(int);
int __real_renameat(int, const char *, int, const char *);
int __real_unlinkat(int, const char *, int);
int __real_poll(struct pollfd *, nfds_t, int);
int __real_fcntl(int, int, ...);

static int fds[32], fd_count, directories, streams, opens, temp_attempts;
static int write_calls, write_interrupted, read_interrupted, file_interrupted, dir_interrupted, poll_interrupted;
static int names_seen;
static int enabled(const char *name) { return getenv(name) != NULL; }
static int number(const char *name) { const char *p = getenv(name); return p == NULL ? 0 : atoi(p); }
static void event(const char *name) { if (enabled("OS_LAB_TRACE")) { fprintf(stderr, "LAB_EVENT %s\n", name); } }
static int is_directory(int fd) { struct stat st; return __real_fstat(fd, &st) == 0 && S_ISDIR(st.st_mode); }
static void track(int fd) { if (fd >= 0 && fd_count < 32) { fds[fd_count++] = fd; } }
static void forget(int fd) {
    for (int i = 0; i < fd_count; i++) { if (fds[i] == fd) { fds[i] = fds[--fd_count]; return; } }
}
int __wrap_open(const char *path, int flags, ...) {
    mode_t mode = 0;
    if (flags & O_CREAT) { va_list a; va_start(a, flags); mode = (mode_t)va_arg(a, int); va_end(a); }
    opens++;
    if (number("OS_LAB_OPEN_FAIL_AT") == opens) { errno = EACCES; return -1; }
    int fd = __real_open(path, flags, mode);
    track(fd);
    if (fd >= 0) { event(is_directory(fd) ? "open_dir" : "open_file"); }
    return fd;
}
int __wrap_openat(int base, const char *path, int flags, ...) {
    mode_t mode = 0;
    if (flags & O_CREAT) { va_list a; va_start(a, flags); mode = (mode_t)va_arg(a, int); va_end(a); temp_attempts++; }
    if (enabled("OS_LAB_OPENAT_FAIL")) { errno = EACCES; return -1; }
    if ((flags & O_CREAT) && temp_attempts <= number("OS_LAB_TEMP_COLLISIONS")) { errno = EEXIST; return -1; }
    int fd = __real_openat(base, path, flags, mode);
    track(fd);
    if (fd >= 0) { event((flags & O_CREAT) ? "create_temp" : "open_file"); }
    return fd;
}
int __wrap_close(int fd) {
    int directory = is_directory(fd);
    int result = __real_close(fd);
    if (result == 0) { forget(fd); event(directory ? "close_dir" : "close_file"); }
    if (result == 0 && enabled(directory ? "OS_LAB_CLOSE_DIR_ERROR" : "OS_LAB_CLOSE_FILE_ERROR")) { errno = EIO; return -1; }
    return result;
}
int __wrap_dup(int fd) {
    if (enabled("OS_LAB_DUP_FAIL")) { errno = EMFILE; return -1; }
    int result = __real_dup(fd); track(result); return result;
}
int __wrap_pipe(int fd[2]) {
    int result = __real_pipe(fd);
    if (result == 0) { track(fd[0]); track(fd[1]); }
    return result;
}
int __wrap_fstat(int fd, struct stat *info) {
    if (enabled("OS_LAB_FSTAT_FAIL")) { errno = EIO; return -1; }
    return __real_fstat(fd, info);
}
ssize_t __wrap_write(int fd, const void *data, size_t length) {
    if (fd != 1 && fd != 2) {
        write_calls++;
        if (enabled("OS_LAB_WRITE_EINTR") && !write_interrupted++) { errno = EINTR; return -1; }
        if (enabled("OS_LAB_WRITE_ZERO")) { return 0; }
        if (number("OS_LAB_WRITE_FAIL_AFTER") && write_calls > number("OS_LAB_WRITE_FAIL_AFTER")) { errno = EIO; return -1; }
        if (enabled("OS_LAB_WRITE_SHORT") && length > 2) { length = 2; }
    }
    ssize_t result = __real_write(fd, data, length);
    if (result > 0 && fd != 1 && fd != 2) { event("write"); }
    return result;
}
ssize_t __wrap_read(int fd, void *data, size_t length) {
    if (enabled("OS_LAB_READ_EINTR") && !read_interrupted++) { errno = EINTR; return -1; }
    if (enabled("OS_LAB_READ_ZERO")) { return 0; }
    return __real_read(fd, data, length);
}
DIR *__wrap_opendir(const char *path) {
    if (enabled("OS_LAB_OPENDIR_FAIL")) { errno = EACCES; return NULL; }
    DIR *result = __real_opendir(path);
    if (result != NULL) { directories++; }
    return result;
}
struct dirent *__wrap_readdir(DIR *directory) {
    if (number("OS_LAB_READDIR_FAIL_AFTER") && names_seen >= number("OS_LAB_READDIR_FAIL_AFTER")) { errno = EIO; return NULL; }
    struct dirent *entry = __real_readdir(directory);
    if (entry != NULL) {
        if (strcmp(entry->d_name, ".") != 0 && strcmp(entry->d_name, "..") != 0) { names_seen++; }
        if (enabled("OS_LAB_UNKNOWN_TYPE")) { entry->d_type = DT_UNKNOWN; }
    }
    return entry;
}
int __wrap_closedir(DIR *directory) {
    int result = __real_closedir(directory); directories--;
    if (enabled("OS_LAB_CLOSEDIR_ERROR")) { errno = EIO; return -1; }
    return result;
}
int __wrap_dirfd(DIR *directory) {
    if (enabled("OS_LAB_DIRFD_FAIL")) { errno = EBADF; return -1; }
    return __real_dirfd(directory);
}
int __wrap_fstatat(int base, const char *name, struct stat *info, int flags) {
    if (enabled("OS_LAB_FSTATAT_FAIL")) { errno = EIO; return -1; }
    return __real_fstatat(base, name, info, flags);
}
FILE *__wrap_fopen(const char *name, const char *mode) {
    FILE *result = __real_fopen(name, mode);
    if (result != NULL) { streams++; }
    return result;
}
size_t __wrap_fwrite(const void *data, size_t size, size_t count, FILE *stream) {
    if (enabled("OS_LAB_FWRITE_FAIL")) { errno = EIO; return 0; }
    return __real_fwrite(data, size, count, stream);
}
int __wrap_fputc(int value, FILE *stream) {
    if (enabled("OS_LAB_FPUTC_FAIL")) { errno = EIO; return EOF; }
    return __real_fputc(value, stream);
}
int __wrap_fflush(FILE *stream) {
    int result = __real_fflush(stream);
    if (enabled("OS_LAB_FLUSH_FAIL")) { errno = EIO; return EOF; }
    return result;
}
int __wrap_fclose(FILE *stream) {
    int result = __real_fclose(stream); streams--;
    if (enabled("OS_LAB_FCLOSE_ERROR")) { errno = EIO; return EOF; }
    return result;
}
int __wrap_fileno(FILE *stream) {
    if (enabled("OS_LAB_FILENO_FAIL")) { errno = EBADF; return -1; }
    return __real_fileno(stream);
}
int __wrap_fsync(int fd) {
    int directory = is_directory(fd);
    int *interrupted = directory ? &dir_interrupted : &file_interrupted;
    if (enabled("OS_LAB_SYNC_EINTR") && !(*interrupted)++) { errno = EINTR; return -1; }
    if (enabled(directory ? "OS_LAB_SYNC_DIR_FAIL" : "OS_LAB_SYNC_FILE_FAIL")) { errno = EIO; return -1; }
    int result = __real_fsync(fd);
    if (result == 0) { event(directory ? "sync_dir" : "sync_file"); }
    return result;
}
int __wrap_renameat(int oldbase, const char *oldname, int newbase, const char *newname) {
    if (enabled("OS_LAB_RENAME_FAIL")) { errno = EIO; return -1; }
    int result = __real_renameat(oldbase, oldname, newbase, newname);
    if (result == 0) { event("rename"); }
    return result;
}
int __wrap_unlinkat(int base, const char *name, int flags) {
    if (enabled("OS_LAB_UNLINK_FAIL")) { errno = EACCES; return -1; }
    int result = __real_unlinkat(base, name, flags);
    if (result == 0) { event("unlink_temp"); }
    return result;
}
int __wrap_poll(struct pollfd *fds, nfds_t count, int timeout) {
    if (enabled("OS_LAB_POLL_EINTR") && !poll_interrupted++) { errno = EINTR; return -1; }
    if (enabled("OS_LAB_POLL_FAIL")) { errno = EIO; return -1; }
    return __real_poll(fds, count, timeout);
}
int __wrap_fcntl(int fd, int command, ...) {
    if (enabled("OS_LAB_FCNTL_FAIL")) { errno = EIO; return -1; }
    if (command == F_GETFL) { return __real_fcntl(fd, command); }
    va_list a; va_start(a, command); int value = va_arg(a, int); va_end(a);
    return __real_fcntl(fd, command, value);
}
__attribute__((destructor)) static void audit(void) {
    if (!enabled("OS_LAB_AUDIT")) { return; }
    fprintf(stderr, "LAB_AUDIT descriptors=%d directories=%d streams=%d\n", fd_count, directories, streams);
    if (fd_count || directories || streams) { fputs("LAB_UNBALANCED\n", stderr); }
}
