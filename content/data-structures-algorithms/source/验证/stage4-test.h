#ifndef DSA_STAGE4_TEST_H
#define DSA_STAGE4_TEST_H
#include <stddef.h>
void s4_need(int condition, const char *message);
void s4_fail_at(size_t request);
size_t s4_requests(void);
size_t s4_live(void);
int s4_owned(const void *pointer);
#endif
