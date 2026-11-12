#ifndef DSA_INTERVAL_H
#define DSA_INTERVAL_H
#include "design.h"
typedef struct { unsigned id, start, end; } Activity;
typedef struct { unsigned ids[D_ITEMS]; size_t count; } Schedule;
DStatus activity_select(const Activity *items, size_t n, Schedule *out);
#endif
