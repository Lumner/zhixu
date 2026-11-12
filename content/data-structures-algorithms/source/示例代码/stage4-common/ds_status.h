#ifndef DSA_DS_STATUS_H
#define DSA_DS_STATUS_H

#include <stddef.h>

#define DS_MAX_ITEMS 64

typedef enum {
    DS_OK, DS_RANGE, DS_FULL, DS_EMPTY, DS_MEMORY, DS_INVALID
} DsStatus;

#endif
