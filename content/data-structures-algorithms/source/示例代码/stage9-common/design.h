#ifndef DSA_DESIGN_H
#define DSA_DESIGN_H
#include <stddef.h>
#define D_ITEMS 8
#define D_LIMIT 60
#define D_COINS 8
#define D_DENOM 20
#define D_SUB_VALUE 20
#define D_SUB_TARGET 160
#define D_SUB_SOLUTIONS 256
#define D_VALUE 100
typedef enum { D_OK, D_INVALID, D_RANGE, D_STUCK } DStatus;
#endif
