/* Test-only wrappers, linked explicitly; never installed into the host. */
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <unistd.h>

int __real_clock_gettime(clockid_t, struct timespec *);
int __wrap_clock_gettime(clockid_t clock, struct timespec *value) {
    static int calls;
    const char *number = getenv("CAP_CLOCK_FAIL");
    if (number != NULL && ++calls == atoi(number)) { errno = EIO; return -1; }
    return __real_clock_gettime(clock, value);
}
int __real_nanosleep(const struct timespec *, struct timespec *);
int __wrap_nanosleep(const struct timespec *request, struct timespec *remaining) {
    static int interrupted;
    if (getenv("CAP_SLEEP_FAIL")) { errno = EIO; return -1; }
    if (getenv("CAP_SLEEP_EINTR") && !interrupted++) {
        *remaining = *request;
        errno = EINTR;
        return -1;
    }
    return __real_nanosleep(request, remaining);
}
int __real_fflush(FILE *);
int __wrap_fflush(FILE *file) {
    int result = __real_fflush(file);
    if (getenv("CAP_FLUSH_FAIL")) { errno = EIO; return EOF; }
    return result;
}
int __real_kill(pid_t, int);
int __wrap_kill(pid_t pid, int number) {
    if (getenv("CAP_ABORT_AUDIT") && number == SIGKILL && pid > 0) {
        fputs("LAB_ABORT_OWN_CHILD\n", stderr);
    }
    return __real_kill(pid, number);
}
