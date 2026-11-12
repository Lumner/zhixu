#include <stdio.h>

static void advance_local(int *p) {
    p = p + 1;
    printf("inside = %d\n", *p);
}

static void set_first(int *p) {
    *p = 9;
}

int main(void) {
    int values[2] = {3, 4};
    int *p = &values[0];
    advance_local(p);
    printf("after local = %d\n", *p);
    set_first(p);
    printf("after store = %d\n", values[0]);
    return 0;
}
