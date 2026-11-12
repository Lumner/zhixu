/* GNU ld test wrappers. Only temporary tutorial binaries link this file. */
#include "lab.h"
#include <pthread.h>
#include <semaphore.h>
#include <stdatomic.h>

int __real_pthread_create(pthread_t *, const pthread_attr_t *, void *(*)(void *), void *);
int __real_pthread_join(pthread_t, void **);
int __real_pthread_cond_wait(pthread_cond_t *, pthread_mutex_t *);
int __real_pthread_cond_broadcast(pthread_cond_t *);
int __real_pthread_mutex_destroy(pthread_mutex_t *);
int __real_pthread_cond_destroy(pthread_cond_t *);
int __real_sem_wait(sem_t *);
int __real_sem_init(sem_t *, int, unsigned int);
int __real_sem_destroy(sem_t *);
void *__real_malloc(size_t);
void __real_free(void *);

static atomic_int calls, created, joined, mutex_destroyed, cond_destroyed;
static atomic_int sem_initialized, sem_destroyed, interrupted, injected, live_allocations;
static pthread_mutex_t gate_lock = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t gate_changed = PTHREAD_COND_INITIALIZER;
static int reached_wait;
static _Thread_local int simulated_returns;
static int enabled(const char *name) { return getenv(name) != NULL; }

int __wrap_pthread_create(pthread_t *thread, const pthread_attr_t *attr,
                          void *(*entry)(void *), void *arg) {
    int number = atomic_fetch_add(&calls, 1) + 1;
    if (number == 2 && enabled("OS_LAB_GATE_SECOND")) {
        thread_check(pthread_mutex_lock(&gate_lock), "test gate lock");
        while (!reached_wait) {
            thread_check(__real_pthread_cond_wait(&gate_changed, &gate_lock), "test gate wait");
        }
        thread_check(pthread_mutex_unlock(&gate_lock), "test gate unlock");
    }
    const char *fail = getenv("OS_LAB_CREATE_FAIL");
    if (fail != NULL && number == atoi(fail)) { errno = EBADF; return EAGAIN; }
    int code = __real_pthread_create(thread, attr, entry, arg);
    if (code == 0) { atomic_fetch_add(&created, 1); }
    return code;
}
int __wrap_pthread_join(pthread_t thread, void **result) {
    int code = __real_pthread_join(thread, result);
    if (code == 0) { atomic_fetch_add(&joined, 1); }
    return code;
}
int __wrap_pthread_cond_wait(pthread_cond_t *condition, pthread_mutex_t *mutex) {
    if (enabled("OS_LAB_GATE_SECOND")) {
        thread_check(pthread_mutex_lock(&gate_lock), "test notify lock");
        reached_wait = 1;
        thread_check(__real_pthread_cond_broadcast(&gate_changed), "test notify");
        thread_check(pthread_mutex_unlock(&gate_lock), "test notify unlock");
    }
    if (enabled("OS_LAB_SPURIOUS") && simulated_returns < 3) {
        simulated_returns++;
        atomic_fetch_add(&injected, 1);
        return 0; /* Caller still holds mutex, predicate intentionally unchanged. */
    }
    return __real_pthread_cond_wait(condition, mutex);
}
int __wrap_pthread_cond_broadcast(pthread_cond_t *condition) {
    return __real_pthread_cond_broadcast(condition);
}
int __wrap_pthread_mutex_destroy(pthread_mutex_t *mutex) {
    int code = __real_pthread_mutex_destroy(mutex);
    if (code == 0) { atomic_fetch_add(&mutex_destroyed, 1); }
    return code;
}
int __wrap_pthread_cond_destroy(pthread_cond_t *condition) {
    int code = __real_pthread_cond_destroy(condition);
    if (code == 0) { atomic_fetch_add(&cond_destroyed, 1); }
    return code;
}
int __wrap_sem_wait(sem_t *credit) {
    if (enabled("OS_LAB_SEM_EINTR") && atomic_exchange(&interrupted, 1) == 0) {
        errno = EINTR;
        return -1;
    }
    return __real_sem_wait(credit);
}
int __wrap_sem_init(sem_t *credit, int shared, unsigned int value) {
    int result = __real_sem_init(credit, shared, value);
    if (result == 0) { atomic_fetch_add(&sem_initialized, 1); }
    return result;
}
int __wrap_sem_destroy(sem_t *credit) {
    int result = __real_sem_destroy(credit);
    if (result == 0) { atomic_fetch_add(&sem_destroyed, 1); }
    return result;
}
void *__wrap_malloc(size_t size) {
    if (enabled("OS_LAB_ALLOC_FAIL")) { errno = ENOMEM; return NULL; }
    void *result = __real_malloc(size);
    if (result != NULL) { atomic_fetch_add(&live_allocations, 1); }
    return result;
}
void __wrap_free(void *pointer) {
    if (pointer != NULL) { atomic_fetch_sub(&live_allocations, 1); }
    __real_free(pointer);
}
__attribute__((destructor)) static void audit(void) {
    if (!enabled("OS_LAB_AUDIT")) { return; }
    int c = atomic_load(&created), j = atomic_load(&joined);
    int si = atomic_load(&sem_initialized), sd = atomic_load(&sem_destroyed);
    int live = atomic_load(&live_allocations);
    fprintf(stderr, "LAB_AUDIT created=%d joined=%d mutex_destroy=%d cond_destroy=%d sem_init=%d sem_destroy=%d live=%d injected=%d reached_wait=%d\n",
            c, j, atomic_load(&mutex_destroyed), atomic_load(&cond_destroyed), si, sd, live,
            atomic_load(&injected), reached_wait);
    if (c != j || si != sd || live != 0) { fputs("LAB_UNBALANCED\n", stderr); }
}
