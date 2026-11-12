#include "stage6-test.h"
#include <stdint.h>
size_t s6_live = 0, s6_attempts = 0;
static void *owners[256];
static long remaining = -1;
void s6_fail_after(long successes) { remaining = successes; }
static int allowed(void)
{
    s6_attempts++;
    if (remaining == 0) { return 0; }
    if (remaining > 0) { remaining--; }
    return 1;
}
static size_t owner_slot(void *pointer)
{
    for (size_t i = 0; i < 256; i++) { if (owners[i] == pointer) { return i; } }
    REQUIRE(0, "unknown owner or owner table full");
    return 0;
}
void *s6_malloc(size_t size)
{
    REQUIRE(size > 0, "positive allocation");
    if (!allowed()) { return NULL; }
    size_t slot = owner_slot(NULL);
    void *result = malloc(size); REQUIRE(result != NULL, "backing malloc");
    owners[slot] = result; s6_live++; return result;
}
void *s6_calloc(size_t count, size_t size)
{
    REQUIRE(count > 0 && size > 0 && count <= SIZE_MAX / size, "calloc size");
    if (!allowed()) { return NULL; }
    size_t slot = owner_slot(NULL);
    void *result = calloc(count, size); REQUIRE(result != NULL, "backing calloc");
    owners[slot] = result; s6_live++; return result;
}
void *s6_realloc(void *pointer, size_t size)
{
    REQUIRE(size > 0, "positive realloc");
    if (!allowed()) { return NULL; }
    size_t slot = owner_slot(pointer);
    int is_new = pointer == NULL;
    void *result = realloc(pointer, size); REQUIRE(result != NULL, "backing realloc");
    owners[slot] = result;
    if (is_new) { s6_live++; }
    return result;
}
void s6_free(void *pointer)
{
    if (pointer != NULL) { size_t slot = owner_slot(pointer); owners[slot] = NULL; s6_live--; free(pointer); }
}
