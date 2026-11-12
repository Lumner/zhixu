#ifndef DSA_PLANNER_TEST_H
#define DSA_PLANNER_TEST_H
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#define P_CHECK(test) do { if (!(test)) { fprintf(stderr,"planner oracle failed at %d\n",__LINE__); exit(1); } } while (0)
extern size_t p_live, p_attempts, p_open_streams;
FILE *p_temp_file(void);
void p_fail_after(long successes);
void *p_malloc(size_t size);
void *p_calloc(size_t count, size_t size);
void *p_realloc(void *pointer, size_t size);
void p_free(void *pointer);
void p_io_reset(void);
void p_read_fail(FILE *stream, long successes);
void p_write_fail(FILE *stream, long successes);
void p_flush_fail(FILE *stream);
void p_close_fail(size_t nth);
int p_fgetc(FILE *stream);
int p_ferror(FILE *stream);
int p_fprintf(FILE *stream, const char *format, ...);
int p_fflush(FILE *stream);
FILE *p_fopen(const char *path, const char *mode);
int p_fclose(FILE *stream);
#endif
