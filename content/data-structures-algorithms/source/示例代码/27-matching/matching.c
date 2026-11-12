#include "matching.h"

static MStatus validate(const char *text, size_t n, const char *pattern, size_t m, const Match *out)
{
    if (out == NULL || (n != 0 && text == NULL) || (m != 0 && pattern == NULL)) {
        return M_INVALID;
    }
    if (n > MATCH_TEXT_MAX || m > MATCH_PATTERN_MAX) {
        return M_LENGTH;
    }
    return M_OK;
}
MStatus prefix_build(const char *pattern, size_t m, size_t *pi, size_t capacity)
{
    if (m != 0 && (pattern == NULL || pi == NULL)) {
        return M_INVALID;
    }
    if (m > MATCH_PATTERN_MAX || capacity < m) {
        return M_LENGTH;
    }
    if (m == 0) {
        return M_OK;
    }
    pi[0] = 0;
    size_t j = 0;
    for (size_t i = 1; i < m; i++) {
        while (j > 0 && pattern[i] != pattern[j]) {
            j = pi[j - 1];
        }
        if (pattern[i] == pattern[j]) {
            j++;
        }
        pi[i] = j;
    }
    return M_OK;
}
MStatus naive_match(const char *text, size_t n, const char *pattern, size_t m, Match *out)
{
    MStatus status = validate(text, n, pattern, m, out);
    if (status != M_OK) {
        return status;
    }
    Match result = {0, n};
    if (m <= n) {
        for (size_t start = 0; start <= n - m; start++) {
            size_t j = 0;
            while (j < m && text[start + j] == pattern[j]) {
                j++;
            }
            if (j == m) {
                result.found = 1;
                result.index = start;
                break;
            }
        }
    }
    *out = result;
    return M_OK;
}
MStatus kmp_match(const char *text, size_t n, const char *pattern, size_t m, Match *out)
{
    MStatus status = validate(text, n, pattern, m, out);
    if (status != M_OK) {
        return status;
    }
    Match result = {0, n};
    if (m == 0) {
        result.found = 1;
        result.index = 0;
    }
    else if (m <= n) {
        size_t pi[MATCH_PATTERN_MAX];
        (void)prefix_build(pattern, m, pi, MATCH_PATTERN_MAX);
        size_t j = 0;
        for (size_t i = 0; i < n; i++) {
            while (j > 0 && text[i] != pattern[j]) {
                j = pi[j - 1];
            }
            if (text[i] == pattern[j]) {
                j++;
            }
            if (j == m) {
                result.found = 1;
                result.index = i + 1 - m;
                break;
            }
        }
    }
    *out = result;
    return M_OK;
}
