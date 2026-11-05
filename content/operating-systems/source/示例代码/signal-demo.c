#include "lab.h"
#include <signal.h>
#include <time.h>

static volatile sig_atomic_t stopped = 0;
static void on_stop(int signo) { (void)signo; stopped = 1; }

int main(void) {
    struct sigaction action = {0};
    action.sa_handler = on_stop;
    sigemptyset(&action.sa_mask);
    if (sigaction(SIGINT, &action, NULL) < 0) { die("sigaction"); }
    printf("ready pid=%ld\n", (long)getpid());
    fflush(stdout);
    while (!stopped) {
        struct timespec delay = {0, 100000000};
        if (nanosleep(&delay, NULL) < 0 && errno != EINTR) { die("nanosleep"); }
    }
    puts("stopped safely");
    return 0;
}
