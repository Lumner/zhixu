#ifndef DSA_SEQUENCE_H
#define DSA_SEQUENCE_H
#include "ds_status.h"

#define SEQ_CAPACITY 8
typedef struct { int data[SEQ_CAPACITY]; size_t count; } Sequence;

void seq_init(Sequence *list);
DsStatus seq_get(const Sequence *list, size_t position, int *out);
DsStatus seq_set(Sequence *list, size_t position, int value);
DsStatus seq_insert(Sequence *list, size_t position, int value);
DsStatus seq_erase(Sequence *list, size_t position, int *out);
#endif
