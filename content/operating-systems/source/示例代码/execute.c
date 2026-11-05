#include "lab.h"

int main(void) {
    pid_t pid = fork();
    if (pid < 0) { die("fork"); }
    if (pid == 0) {
        char *args[] = {"printf", "exec replaced the child\n", NULL};
        execvp(args[0], args);
        perror("execvp");
        _exit(127);
    }
    int code = wait_child(pid);
    printf("exit=%d\n", code);
    return code;
}
