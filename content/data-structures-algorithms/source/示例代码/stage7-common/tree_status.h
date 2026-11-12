#ifndef DSA_TREE_STATUS_H
#define DSA_TREE_STATUS_H
#include <stddef.h>
#define TREE_LIMIT 63
typedef enum { T_OK, T_DUPLICATE, T_MISSING, T_FULL, T_EMPTY, T_MEMORY, T_INVALID, T_SPACE } TStatus;
#endif
