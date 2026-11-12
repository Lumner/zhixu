#ifndef DSA_MATCHING_H
#define DSA_MATCHING_H
#include <stddef.h>
#define MATCH_TEXT_MAX 256
#define MATCH_PATTERN_MAX 64
typedef enum { M_OK, M_INVALID, M_LENGTH } MStatus;
typedef struct { int found; size_t index; } Match;
MStatus prefix_build(const char *pattern, size_t m, size_t *pi, size_t capacity);
MStatus naive_match(const char *text, size_t n, const char *pattern, size_t m, Match *out);
MStatus kmp_match(const char *text, size_t n, const char *pattern, size_t m, Match *out);
#endif
