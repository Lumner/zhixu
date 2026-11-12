#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>

static int allocations;
static int fail_allocation;
static int live_blocks;
static int reads;
static int fail_read;
static int read_failed;
static int writes;
static int fail_write;
static int fail_flush;

void lab_reset(int allocation, int read, int write, int flush)
{
    allocations = reads = writes = read_failed = 0;
    fail_allocation = allocation;
    fail_read = read;
    fail_write = write;
    fail_flush = flush;
}

int lab_live(void) { return live_blocks; }

void *lab_realloc(void *ptr, size_t bytes)
{
    int was_null = ptr == NULL;
    if (++allocations == fail_allocation) {
        return NULL;
    }
    void *result = realloc(ptr, bytes);
    if (result != NULL && was_null) {
        live_blocks++;
    }
    return result;
}

void lab_free(void *ptr)
{
    if (ptr != NULL) {
        live_blocks--;
    }
    free(ptr);
}

int lab_fgetc(FILE *in)
{
    if (++reads == fail_read) {
        read_failed = 1;
        return EOF;
    }
    return fgetc(in);
}

int lab_ferror(FILE *in) { return read_failed || ferror(in); }

int lab_fprintf(FILE *out, const char *format, ...)
{
    if (++writes == fail_write) {
        return -1;
    }
    va_list args;
    va_start(args, format);
    int result = vfprintf(out, format, args);
    va_end(args);
    return result;
}

int lab_fflush(FILE *out) { return fail_flush ? EOF : fflush(out); }
