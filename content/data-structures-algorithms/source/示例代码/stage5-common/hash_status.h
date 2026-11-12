#ifndef DSA_HASH_STATUS_H
#define DSA_HASH_STATUS_H
#include <stddef.h>
#define H_KEY_MAX 9999
#define H_MAX_ITEMS 48
typedef enum { H_OK, H_DUPLICATE, H_MISSING, H_FULL, H_MEMORY, H_INVALID } HStatus;
#endif
