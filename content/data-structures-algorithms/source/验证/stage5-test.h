#ifndef DSA_STAGE5_TEST_H
#define DSA_STAGE5_TEST_H
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#define REQUIRE(test, label) do { if (!(test)) { fprintf(stderr, "FAIL %s line=%d\n", label, __LINE__); exit(1); } } while (0)
extern size_t s5_live;
extern size_t s5_attempts;
void s5_fail_after(long successes);
void *s5_malloc(size_t size);
void *s5_calloc(size_t count, size_t size);
void s5_free(void *pointer);
#endif
