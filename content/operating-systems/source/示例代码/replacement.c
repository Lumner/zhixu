/* Model: 3 frames, FIFO; -1 denotes an empty frame. */
#include <stdio.h>

int main(void) {
    const int refs[] = {1, 2, 3, 1, 4, 2, 5};
    int frames[] = {-1, -1, -1};
    int next = 0, faults = 0;
    for (size_t i = 0; i < sizeof refs / sizeof refs[0]; i++) {
        int hit = 0;
        for (int j = 0; j < 3; j++) { if (frames[j] == refs[i]) { hit = 1; } }
        if (!hit) {
            frames[next] = refs[i];
            next = (next + 1) % 3;
            faults++;
        }
        printf("ref=%d %s frames=%d,%d,%d\n", refs[i], hit ? "hit" : "fault",
               frames[0], frames[1], frames[2]);
    }
    printf("faults=%d\n", faults);
    return 0;
}
