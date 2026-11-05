#include "lab.h"

int main(void) {
    int value = 10;
    fflush(NULL);
    pid_t pid = fork();
    if (pid < 0) { die("fork"); }
    if (pid == 0) {
        value = 99;
        printf("child value=%d\n", value);
        fflush(stdout);
        _exit(7);
    }
    int code = wait_child(pid);
    printf("parent value=%d child_exit=%d\n", value, code);
    return 0;
}
