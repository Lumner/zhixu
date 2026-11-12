#include "planner-test.h"
#include <stdarg.h>
#include <stdint.h>
size_t p_live, p_attempts, p_open_streams;
static void *owners[256];
static long remaining = -1, read_left = -1, write_left = -1;
static FILE *read_stream, *write_stream, *flush_stream;
static int read_failed;
static size_t close_at, close_calls;
FILE *p_temp_file(void)
{
    static unsigned long serial;
    char path[80];
    (void)snprintf(path,sizeof(path),"planner-test-%lu.tmp",++serial);
    return fopen(path,"w+b");
}
void p_fail_after(long successes) { remaining = successes; }
static int allowed(void)
{
    p_attempts++;
    if (remaining == 0) { return 0; }
    if (remaining > 0) { remaining--; }
    return 1;
}
static size_t owner(void *pointer)
{
    for (size_t i = 0; i < 256; i++) { if (owners[i] == pointer) { return i; } }
    P_CHECK(0); return 0;
}
void *p_malloc(size_t size)
{
    P_CHECK(size != 0);
    if (!allowed()) { return NULL; }
    size_t slot = owner(NULL);
    void *result = malloc(size); P_CHECK(result != NULL);
    owners[slot] = result; p_live++; return result;
}
void *p_calloc(size_t count, size_t size)
{
    P_CHECK(count != 0 && size != 0 && count <= SIZE_MAX / size);
    if (!allowed()) { return NULL; }
    size_t slot = owner(NULL);
    void *result = calloc(count,size); P_CHECK(result != NULL);
    owners[slot] = result; p_live++; return result;
}
void *p_realloc(void *pointer, size_t size)
{
    P_CHECK(size != 0);
    if (!allowed()) { return NULL; }
    size_t slot = owner(pointer); int fresh = pointer == NULL;
    void *result = realloc(pointer,size); P_CHECK(result != NULL);
    owners[slot] = result; if (fresh) { p_live++; } return result;
}
void p_free(void *pointer)
{
    if (pointer != NULL) { owners[owner(pointer)] = NULL; p_live--; free(pointer); }
}
void p_io_reset(void)
{
    read_stream = NULL; write_stream = NULL; flush_stream = NULL;
    read_left = -1; write_left = -1; read_failed = 0; close_at = 0; close_calls = 0;
}
void p_read_fail(FILE *stream, long successes) { read_stream = stream; read_left = successes; read_failed = 0; }
void p_write_fail(FILE *stream, long successes) { write_stream = stream; write_left = successes; }
void p_flush_fail(FILE *stream) { flush_stream = stream; }
void p_close_fail(size_t nth) { close_at = nth; close_calls = 0; }
int p_fgetc(FILE *stream)
{
    if (stream == read_stream && read_left >= 0) {
        if (read_left == 0) { read_failed = 1; return EOF; }
        read_left--;
    }
    return fgetc(stream);
}
int p_ferror(FILE *stream) { return (stream == read_stream && read_failed) || ferror(stream); }
int p_fprintf(FILE *stream, const char *format, ...)
{
    if (stream == write_stream && write_left >= 0) {
        if (write_left == 0) { return -1; }
        write_left--;
    }
    va_list args; va_start(args,format); int result = vfprintf(stream,format,args); va_end(args);
    return result;
}
int p_fflush(FILE *stream) { return stream == flush_stream ? EOF : fflush(stream); }
FILE *p_fopen(const char *path, const char *mode)
{
    FILE *stream = fopen(path,mode); if (stream != NULL) { p_open_streams++; } return stream;
}
int p_fclose(FILE *stream)
{
    int result = fclose(stream); P_CHECK(p_open_streams != 0); p_open_streams--; close_calls++;
    return close_at != 0 && close_calls == close_at ? EOF : result;
}
