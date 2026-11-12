#include "stage5-test.h"
#include <stdint.h>
size_t s5_live = 0;
size_t s5_attempts = 0;
static void *owners[256];
static long remaining = -1;
void s5_fail_after(long successes) { remaining = successes; }
static int allowed(void)
{
    s5_attempts++;
    if (remaining == 0) { return 0; }
    if (remaining > 0) { remaining--; }
    return 1;
}
static void *track(void *pointer)
{
    REQUIRE(pointer != NULL, "test allocator backing allocation");
    for (size_t i = 0; i < 256; i++) {
        if (owners[i] == NULL) { owners[i] = pointer; s5_live++; return pointer; }
    }
    REQUIRE(0, "test owner table full");
    return NULL;
}
void *s5_malloc(size_t size)
{
    if (!allowed()) { return NULL; }
    return track(malloc(size));
}
void *s5_calloc(size_t count, size_t size)
{
    REQUIRE(size == 0 || count <= SIZE_MAX / size, "allocation multiplication");
    if (!allowed()) { return NULL; }
    return track(calloc(count, size));
}
void s5_free(void *pointer)
{
    if (pointer == NULL) { return; }
    for (size_t i = 0; i < 256; i++) {
        if (owners[i] == pointer) { owners[i] = NULL; s5_live--; free(pointer); return; }
    }
    REQUIRE(0, "unknown or repeated free");
}
