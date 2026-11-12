#include "interval.h"
static int earlier(Activity a, Activity b)
{
    if (a.end != b.end) { return a.end < b.end; }
    if (a.start != b.start) { return a.start < b.start; }
    return a.id < b.id;
}
DStatus activity_select(const Activity *items, size_t n, Schedule *out)
{
    if (out == NULL || (n != 0 && items == NULL)) { return D_INVALID; }
    if (n > D_ITEMS) { return D_RANGE; }
    Activity sorted[D_ITEMS];
    for (size_t i = 0; i < n; i++) {
        if (items[i].start > D_LIMIT || items[i].end > D_LIMIT) { return D_RANGE; }
        if (items[i].start >= items[i].end) { return D_INVALID; }
        for (size_t j = 0; j < i; j++) {
            if (items[j].id == items[i].id) { return D_INVALID; }
        }
        sorted[i] = items[i];
    }
    for (size_t i = 1; i < n; i++) {
        Activity saved = sorted[i];
        size_t j = i;
        while (j > 0 && earlier(saved, sorted[j - 1])) {
            sorted[j] = sorted[j - 1]; j--;
        }
        sorted[j] = saved;
    }
    Schedule next = {0};
    unsigned last_end = 0;
    for (size_t i = 0; i < n; i++) {
        if (next.count == 0 || sorted[i].start >= last_end) {
            next.ids[next.count++] = sorted[i].id;
            last_end = sorted[i].end;
        }
    }
    *out = next;
    return D_OK;
}
