/* Test-only GNU ld --wrap shim. No user files or system limits are modified. */
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <errno.h>

void *__real_malloc(size_t);
void *__real_calloc(size_t, size_t);
void *__real_realloc(void *, size_t);
void __real_free(void *);
FILE *__real_fopen(const char *, const char *);
int __real_fclose(FILE *);
char *__real_fgets(char *, int, FILE *);
int __real_fgetc(FILE *);
size_t __real_fread(void *, size_t, size_t, FILE *);
int __real_ferror(FILE *);
size_t __real_fwrite(const void *, size_t, size_t, FILE *);
int __real_fputs(const char *, FILE *);
int __real_fputc(int, FILE *);

static long allocation_calls, open_calls, close_calls, read_calls, write_calls;
static long live_allocations, live_streams;
static int injected_read_error;

static int fail_at(const char *name, long *calls) {
    const char *setting = getenv(name);
    (*calls)++;
    return setting != NULL && strtol(setting, NULL, 10) == *calls;
}

void *__wrap_malloc(size_t size) {
    if (fail_at("OS_LAB_FAIL_ALLOC_AT", &allocation_calls)) { errno = ENOMEM; return NULL; }
    void *p = __real_malloc(size);
    if (p != NULL) { live_allocations++; }
    return p;
}

void *__wrap_calloc(size_t count, size_t size) {
    if (fail_at("OS_LAB_FAIL_ALLOC_AT", &allocation_calls)) { errno = ENOMEM; return NULL; }
    void *p = __real_calloc(count, size);
    if (p != NULL) { live_allocations++; }
    return p;
}

void *__wrap_realloc(void *old, size_t size) {
    if (fail_at("OS_LAB_FAIL_ALLOC_AT", &allocation_calls)) { errno = ENOMEM; return NULL; }
    int was_null = old == NULL;
    void *p = __real_realloc(old, size);
    if (p != NULL && was_null) { live_allocations++; }
    return p;
}

void __wrap_free(void *p) {
    if (p != NULL) { live_allocations--; }
    __real_free(p);
}

FILE *__wrap_fopen(const char *name, const char *mode) {
    if (fail_at("OS_LAB_FAIL_OPEN_AT", &open_calls)) { errno = EACCES; return NULL; }
    FILE *file = __real_fopen(name, mode);
    if (file != NULL) { live_streams++; }
    return file;
}

int __wrap_fclose(FILE *file) {
    int result = __real_fclose(file);
    live_streams--;
    if (fail_at("OS_LAB_FAIL_CLOSE_AT", &close_calls)) { errno = EIO; return EOF; }
    return result;
}

static int read_fails(void) {
    if (fail_at("OS_LAB_FAIL_READ_AT", &read_calls)) {
        injected_read_error = 1;
        errno = EIO;
        return 1;
    }
    return 0;
}

char *__wrap_fgets(char *s, int size, FILE *file) {
    if (read_fails()) { return NULL; }
    return __real_fgets(s, size, file);
}

int __wrap_fgetc(FILE *file) {
    if (read_fails()) { return EOF; }
    return __real_fgetc(file);
}

size_t __wrap_fread(void *p, size_t size, size_t count, FILE *file) {
    if (read_fails()) { return 0; }
    return __real_fread(p, size, count, file);
}

int __wrap_ferror(FILE *file) {
    return injected_read_error || __real_ferror(file);
}

static int write_fails(FILE *file) {
    if (file == stderr) { return 0; }
    if (fail_at("OS_LAB_FAIL_WRITE_AT", &write_calls)) { errno = EIO; return 1; }
    return 0;
}

size_t __wrap_fwrite(const void *p, size_t size, size_t count, FILE *file) {
    if (write_fails(file)) { return 0; }
    return __real_fwrite(p, size, count, file);
}

int __wrap_fputs(const char *s, FILE *file) {
    if (write_fails(file)) { return EOF; }
    return __real_fputs(s, file);
}

int __wrap_fputc(int ch, FILE *file) {
    if (write_fails(file)) { return EOF; }
    return __real_fputc(ch, file);
}

int __wrap_fprintf(FILE *file, const char *format, ...) {
    if (write_fails(file)) { return -1; }
    va_list args;
    va_start(args, format);
    int result = vfprintf(file, format, args);
    va_end(args);
    return result;
}

__attribute__((destructor)) static void verify_balanced_resources(void) {
    if (live_allocations != 0 || live_streams != 0) {
        fprintf(stderr, "LAB_UNBALANCED allocations=%ld streams=%ld\n", live_allocations, live_streams);
        _Exit(90);
    }
}
