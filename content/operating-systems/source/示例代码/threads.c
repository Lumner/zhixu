#include "lab.h"
#include <pthread.h>

struct Input { int value; };
static void *work(void *arg) {
    struct Input *input = arg;
    input->value *= 2;
    return NULL;
}

int main(void) {
    pthread_t threads[2];
    struct Input inputs[2] = {{10}, {20}};
    for (int i = 0; i < 2; i++) {
        thread_check(pthread_create(&threads[i], NULL, work, &inputs[i]), "create");
    }
    for (int i = 0; i < 2; i++) {
        thread_check(pthread_join(threads[i], NULL), "join");
    }
    printf("results=%d,%d\n", inputs[0].value, inputs[1].value);
    return 0;
}
