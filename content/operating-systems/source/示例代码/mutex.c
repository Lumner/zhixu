#include "lab.h"
#include <pthread.h>

static long counter = 0;
static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
static void *work(void *unused) {
    (void)unused;
    for (int i = 0; i < 10000; i++) {
        thread_check(pthread_mutex_lock(&lock), "lock");
        counter++;
        thread_check(pthread_mutex_unlock(&lock), "unlock");
    }
    return NULL;
}

int main(void) {
    pthread_t a, b;
    thread_check(pthread_create(&a, NULL, work, NULL), "create a");
    thread_check(pthread_create(&b, NULL, work, NULL), "create b");
    thread_check(pthread_join(a, NULL), "join a");
    thread_check(pthread_join(b, NULL), "join b");
    printf("counter=%ld\n", counter);
    thread_check(pthread_mutex_destroy(&lock), "destroy");
    return 0;
}
