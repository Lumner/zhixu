#include "stage4-test.h"
#include <stdio.h>
#include <stdlib.h>

static void *blocks[512];
static size_t requests, failing;
void s4_need(int condition, const char *message)
{
    if (!condition) { fprintf(stderr, "failed: %s\n", message); exit(1); }
}
static size_t locate(const void *pointer)
{
    for (size_t i = 0; i < 512; i++) if (blocks[i] == pointer) return i;
    return 512;
}
int s4_owned(const void *pointer) { return pointer != NULL && locate(pointer) < 512; }
void s4_fail_at(size_t request) { requests = 0; failing = request; }
size_t s4_requests(void) { return requests; }
size_t s4_live(void)
{
    size_t n = 0;
    for (size_t i = 0; i < 512; i++) if (blocks[i] != NULL) n++;
    return n;
}
void *s4_malloc(size_t bytes)
{
    if (++requests == failing) return NULL;
    size_t slot = locate(NULL);
    s4_need(slot < 512, "allocation audit capacity");
    void *result = malloc(bytes);
    if (result != NULL) blocks[slot] = result;
    return result;
}
void *s4_realloc(void *pointer, size_t bytes)
{
    size_t slot = locate(pointer);
    s4_need(slot < 512, "realloc ownership or free slot");
    if (++requests == failing) return NULL;
    void *result = realloc(pointer, bytes);
    if (result != NULL) blocks[slot] = result;
    return result;
}
void s4_free(void *pointer)
{
    if (pointer != NULL) {
        size_t slot = locate(pointer);
        s4_need(slot < 512, "free ownership");
        blocks[slot] = NULL;
    }
    free(pointer);
}
