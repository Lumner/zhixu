#include "lab.h"
#include <pthread.h>

static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t changed = PTHREAD_COND_INITIALIZER;
static int slot = 0, full = 0, done = 0, total = 0;

static void *producer(void *unused) {
    (void)unused;
    for (int value = 1; value <= 5; value++) {
        thread_check(pthread_mutex_lock(&lock), "lock");
        while (full) { thread_check(pthread_cond_wait(&changed, &lock), "wait"); }
        slot = value;
        full = 1;
        thread_check(pthread_cond_broadcast(&changed), "broadcast");
        thread_check(pthread_mutex_unlock(&lock), "unlock");
    }
    thread_check(pthread_mutex_lock(&lock), "lock");
    done = 1;
    thread_check(pthread_cond_broadcast(&changed), "broadcast");
    thread_check(pthread_mutex_unlock(&lock), "unlock");
    return NULL;
}

static void *consumer(void *unused) {
    (void)unused;
    thread_check(pthread_mutex_lock(&lock), "lock");
    for (;;) {
        while (!full && !done) {
            thread_check(pthread_cond_wait(&changed, &lock), "wait");
        }
        if (!full && done) { break; }
        total += slot;
        full = 0;
        thread_check(pthread_cond_broadcast(&changed), "broadcast");
    }
    thread_check(pthread_mutex_unlock(&lock), "unlock");
    return NULL;
}

int main(void) {
    pthread_t p, c;
    thread_check(pthread_create(&p, NULL, producer, NULL), "create producer");
    thread_check(pthread_create(&c, NULL, consumer, NULL), "create consumer");
    thread_check(pthread_join(p, NULL), "join producer");
    thread_check(pthread_join(c, NULL), "join consumer");
    printf("sum=%d\n", total);
    thread_check(pthread_cond_destroy(&changed), "destroy condition");
    thread_check(pthread_mutex_destroy(&lock), "destroy mutex");
    return 0;
}
