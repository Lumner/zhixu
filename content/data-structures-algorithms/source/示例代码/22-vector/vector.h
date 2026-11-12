#ifndef DSA_VECTOR_H
#define DSA_VECTOR_H
#include "ds_status.h"

typedef struct { int *data; size_t count; size_t capacity; } Vector;
void vec_init(Vector *list);
void vec_clear(Vector *list);
DsStatus vec_reserve(Vector *list, size_t capacity);
DsStatus vec_get(const Vector *list, size_t position, int *out);
DsStatus vec_set(Vector *list, size_t position, int value);
DsStatus vec_insert(Vector *list, size_t position, int value);
DsStatus vec_erase(Vector *list, size_t position, int *out);
#endif
