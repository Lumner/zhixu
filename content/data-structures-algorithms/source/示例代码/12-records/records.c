#include <stdio.h>

typedef enum { PLANNED, DONE } State;

typedef struct {
    int id;
    char title[16];
    int minutes;
    State state;
} Record;

void mark_done(Record *record)
{
    if (record != NULL) {
        record->state = DONE;
    }
}

int main(void)
{
    Record original = {1, "C basics", 30, PLANNED};
    Record copy = original;
    copy.title[0] = 'X';
    mark_done(&copy);
    printf("original=%s,%d\n", original.title, original.state);
    printf("copy=%s,%d\n", copy.title, copy.state);
    return 0;
}
