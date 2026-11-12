#ifndef DSA_STAGE6_TEST_H
#define DSA_STAGE6_TEST_H
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#define REQUIRE(test, label) do { if (!(test)) { fprintf(stderr, "FAIL %s line=%d\n", label, __LINE__); exit(1); } } while (0)
extern size_t s6_live;
extern size_t s6_attempts;
void s6_fail_after(long successes);
void *s6_malloc(size_t size);
void *s6_calloc(size_t count, size_t size);
void *s6_realloc(void *pointer, size_t size);
void s6_free(void *pointer);
#endif
