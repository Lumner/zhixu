/* Single-threaded GNU ld wrappers for temporary memory-lab executables only. */
#include "lab.h"
#include <sys/mman.h>
#include <inttypes.h>
#include <stdint.h>

void *__real_malloc(size_t);
void __real_free(void *);
FILE *__real_fopen(const char *, const char *);
FILE *__real_tmpfile(void);
int __real_fclose(FILE *);
char *__real_fgets(char *, int, FILE *);
int __real_ferror(FILE *);
int __real_fileno(FILE *);
int __real_mkstemp(char *);
int __real_close(int);
ssize_t __real_pwrite(int, const void *, size_t, off_t);
ssize_t __real_pread(int, void *, size_t, off_t);
void *__real_mmap(void *, size_t, int, int, int, off_t);
int __real_munmap(void *, size_t);
int __real_mprotect(void *, size_t, int);
int __real_msync(void *, size_t, int);
long __real_sysconf(int);

static int allocations, streams, descriptors, mapping_count;
static void *mappings[16];
static int mmap_calls, unmap_calls, pread_calls, pwrite_interrupted, pread_interrupted;
static int simulated_stream_error;
static uintptr_t allocated_address;
static int enabled(const char *name) { return getenv(name) != NULL; }
static int at(const char *name, int number) {
    const char *value = getenv(name);
    return value != NULL && atoi(value) == number;
}
void *__wrap_malloc(size_t size) {
    if (enabled("OS_LAB_ALLOC_FAIL")) { errno = ENOMEM; return NULL; }
    void *result = __real_malloc(size);
    if (result != NULL) { allocations++; allocated_address = (uintptr_t)result; }
    return result;
}
void __wrap_free(void *pointer) {
    if (pointer != NULL) { allocations--; }
    __real_free(pointer);
}
FILE *__wrap_fopen(const char *name, const char *mode) {
    if (enabled("OS_LAB_FOPEN_FAIL")) { errno = EACCES; return NULL; }
    FILE *result;
    if (enabled("OS_LAB_LONG_MAPS") && strcmp(name, "/proc/self/maps") == 0) {
        result = __real_tmpfile();
        if (result != NULL) {
            int length = fprintf(result, "0-0 r--p ");
            while (length < 511) { fputc('x', result); length++; }
            fprintf(result, "%" PRIxPTR "-%" PRIxPTR " r--p path-continuation\n",
                    allocated_address, allocated_address + 64);
            fprintf(result, "%" PRIxPTR "-%" PRIxPTR " rw-p actual-header\n",
                    allocated_address, allocated_address + 64);
            rewind(result);
        }
    } else { result = __real_fopen(name, mode); }
    if (result != NULL) { streams++; }
    return result;
}
FILE *__wrap_tmpfile(void) {
    if (enabled("OS_LAB_TMPFILE_FAIL")) { errno = ENOSPC; return NULL; }
    FILE *result = __real_tmpfile();
    if (result != NULL) { streams++; }
    return result;
}
int __wrap_fclose(FILE *file) {
    int result = __real_fclose(file);
    streams--; /* fclose consumes the stream, including a reported late error. */
    if (enabled("OS_LAB_FCLOSE_ERROR")) { errno = EIO; return EOF; }
    return result;
}
char *__wrap_fgets(char *line, int size, FILE *file) {
    if (enabled("OS_LAB_FGETS_ERROR")) { simulated_stream_error = 1; errno = EIO; return NULL; }
    return __real_fgets(line, size, file);
}
int __wrap_ferror(FILE *file) { return simulated_stream_error || __real_ferror(file); }
int __wrap_fileno(FILE *file) {
    if (enabled("OS_LAB_FILENO_FAIL")) { errno = EBADF; return -1; }
    return __real_fileno(file);
}
int __wrap_mkstemp(char *name) {
    if (enabled("OS_LAB_MKSTEMP_FAIL")) { errno = EACCES; return -1; }
    int result = __real_mkstemp(name);
    if (result >= 0) { descriptors++; }
    return result;
}
int __wrap_close(int fd) {
    int result = __real_close(fd);
    if (result == 0) { descriptors--; }
    if (enabled("OS_LAB_CLOSE_ERROR") && result == 0) { errno = EIO; return -1; }
    return result;
}
ssize_t __wrap_pwrite(int fd, const void *data, size_t size, off_t offset) {
    if (enabled("OS_LAB_PWRITE_EINTR") && !pwrite_interrupted++) { errno = EINTR; return -1; }
    if (enabled("OS_LAB_PWRITE_ERROR")) { errno = EIO; return -1; }
    if (enabled("OS_LAB_PWRITE_SHORT") && size > 2) { size = 2; }
    return __real_pwrite(fd, data, size, offset);
}
ssize_t __wrap_pread(int fd, void *data, size_t size, off_t offset) {
    if (enabled("OS_LAB_PREAD_EINTR") && !pread_interrupted++) { errno = EINTR; return -1; }
    pread_calls++;
    if (at("OS_LAB_PREAD_ZERO", pread_calls)) { return 0; }
    if (at("OS_LAB_PREAD_ERROR", pread_calls)) { errno = EIO; return -1; }
    return __real_pread(fd, data, size, offset);
}
void *__wrap_mmap(void *address, size_t length, int prot, int flags, int fd, off_t offset) {
    mmap_calls++;
    if (at("OS_LAB_MMAP_FAIL", mmap_calls)) { errno = ENOMEM; return MAP_FAILED; }
    void *result = __real_mmap(address, length, prot, flags, fd, offset);
    if (result != MAP_FAILED && mapping_count < 16) { mappings[mapping_count++] = result; }
    return result;
}
int __wrap_munmap(void *address, size_t length) {
    unmap_calls++;
    if (at("OS_LAB_UNMAP_FAIL", unmap_calls)) { errno = EINVAL; return -1; }
    int result = __real_munmap(address, length);
    if (result == 0) {
        for (int i = 0; i < mapping_count; i++) {
            if (mappings[i] == address) { mappings[i] = mappings[--mapping_count]; break; }
        }
    }
    return result;
}
int __wrap_mprotect(void *address, size_t length, int prot) {
    if (enabled("OS_LAB_MPROTECT_FAIL")) { errno = EACCES; return -1; }
    return __real_mprotect(address, length, prot);
}
int __wrap_msync(void *address, size_t length, int flags) {
    if (enabled("OS_LAB_MSYNC_FAIL")) { errno = EIO; return -1; }
    return __real_msync(address, length, flags);
}
long __wrap_sysconf(int name) {
    if (enabled("OS_LAB_SYSCONF_FAIL")) { errno = EINVAL; return -1; }
    return __real_sysconf(name);
}
__attribute__((destructor)) static void audit(void) {
    if (!enabled("OS_LAB_AUDIT")) { return; }
    fprintf(stderr, "LAB_AUDIT allocations=%d streams=%d descriptors=%d mappings=%d\n",
            allocations, streams, descriptors, mapping_count);
    if (allocations || streams || descriptors || mapping_count) { fputs("LAB_UNBALANCED\n", stderr); }
}
