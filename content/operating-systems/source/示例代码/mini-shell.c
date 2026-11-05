#include "lab.h"
#include <fcntl.h>
#include <signal.h>

#define MAX_LINE 1024
#define MAX_ARGS 64

struct Command {
    char *left[MAX_ARGS];
    char *right[MAX_ARGS];
    char *output;
    int has_pipe;
};

static int parse(char *line, struct Command *command) {
    memset(command, 0, sizeof *command);
    int left_count = 0, right_count = 0;
    char *state;
    for (char *token = strtok_r(line, " \t\r\n", &state);
         token != NULL; token = strtok_r(NULL, " \t\r\n", &state)) {
        if (strcmp(token, "|") == 0) {
            if (command->has_pipe || left_count == 0 || command->output) { return -1; }
            command->has_pipe = 1;
            continue;
        }
        if (strcmp(token, ">") == 0) {
            if (command->output || (command->has_pipe ? right_count : left_count) == 0) {
                return -1;
            }
            token = strtok_r(NULL, " \t\r\n", &state);
            if (token == NULL || strpbrk(token, "|<>;&'\"\\$`*?()[]{}!#~")) { return -1; }
            command->output = token;
            if (strtok_r(NULL, " \t\r\n", &state) != NULL) { return -1; }
            break;
        }
        if (strpbrk(token, "|<>;&'\"\\$`*?()[]{}!#~")) { return -1; }
        char **args = command->has_pipe ? command->right : command->left;
        int *count = command->has_pipe ? &right_count : &left_count;
        if (*count >= MAX_ARGS - 1) { return -1; }
        args[(*count)++] = token;
    }
    if (command->has_pipe && right_count == 0) { return -1; }
    return left_count;
}

static int is_builtin(const char *name) {
    return strcmp(name, "cd") == 0 || strcmp(name, "pwd") == 0 || strcmp(name, "exit") == 0;
}

static void redirect_output(const char *name) {
    if (name == NULL) { return; }
    int fd = open(name, O_WRONLY | O_CREAT | O_TRUNC, 0666);
    if (fd < 0) { perror("open output"); _exit(1); }
    if (dup2(fd, STDOUT_FILENO) < 0) { perror("dup2 output"); _exit(1); }
    if (fd != STDOUT_FILENO) { close(fd); }
}

static void run_child(char *const args[], int input, int output,
                      const int pipefd[2], const char *filename) {
    struct sigaction action = {0};
    action.sa_handler = SIG_DFL;
    sigemptyset(&action.sa_mask);
    if (sigaction(SIGINT, &action, NULL) < 0) { _exit(1); }
    if (input >= 0 && dup2(input, STDIN_FILENO) < 0) { perror("dup2 input"); _exit(1); }
    if (output >= 0 && dup2(output, STDOUT_FILENO) < 0) { perror("dup2 pipe"); _exit(1); }
    if (pipefd != NULL) {
        close(pipefd[0]);
        close(pipefd[1]);
    }
    redirect_output(filename);
    execvp(args[0], args);
    perror(args[0]);
    _exit(127);
}

static int launch(struct Command *command) {
    int fd[2] = {-1, -1};
    if (command->has_pipe && pipe(fd) < 0) { perror("pipe"); return 1; }
    fflush(NULL);
    pid_t first = fork();
    if (first < 0) {
        perror("fork");
        if (command->has_pipe) { close(fd[0]); close(fd[1]); }
        return 1;
    }
    if (first == 0) {
        run_child(command->left, -1, command->has_pipe ? fd[1] : -1,
                  command->has_pipe ? fd : NULL,
                  command->has_pipe ? NULL : command->output);
    }
    if (!command->has_pipe) { return wait_child(first); }
    pid_t second = fork();
    if (second < 0) {
        perror("fork second");
        close(fd[0]); close(fd[1]);
        (void)wait_child(first);
        return 1;
    }
    if (second == 0) { run_child(command->right, fd[0], -1, fd, command->output); }
    close(fd[0]); close(fd[1]);
    (void)wait_child(first);
    return wait_child(second);
}

int main(void) {
    /* Require normal standard descriptors; pipe descriptors are then >= 3. */
    for (int fd = 0; fd <= 2; fd++) { if (fcntl(fd, F_GETFD) < 0) { return 1; } }
    struct sigaction action = {0};
    action.sa_handler = SIG_IGN;
    sigemptyset(&action.sa_mask);
    if (sigaction(SIGINT, &action, NULL) < 0) { die("sigaction"); }
    int status = 0;
    char line[MAX_LINE];
    for (;;) {
        if (isatty(STDIN_FILENO)) { fputs("os-lab> ", stdout); fflush(stdout); }
        if (fgets(line, sizeof line, stdin) == NULL) {
            if (ferror(stdin)) { perror("input"); return 1; }
            return status;
        }
        if (strchr(line, '\n') == NULL && !feof(stdin)) {
            int ch;
            while ((ch = getchar()) != '\n' && ch != EOF) { }
            fputs("line too long\n", stderr);
            status = 2;
            continue;
        }
        struct Command command;
        int count = parse(line, &command);
        if (count < 0) { fputs("unsupported or invalid syntax\n", stderr); status = 2; continue; }
        if (count == 0) { continue; }
        int builtin = is_builtin(command.left[0]);
        if ((builtin && (command.has_pipe || command.output)) ||
            (command.has_pipe && is_builtin(command.right[0]))) {
            fputs("builtins require a standalone command\n", stderr); status = 2; continue;
        }
        if (strcmp(command.left[0], "exit") == 0) {
            if (count != 1) { fputs("usage: exit\n", stderr); status = 2; continue; }
            return status;
        }
        if (strcmp(command.left[0], "cd") == 0) {
            if (count != 2) { fputs("usage: cd DIRECTORY\n", stderr); status = 2; continue; }
            if (chdir(command.left[1]) < 0) { perror("cd"); status = 1; }
            else { status = 0; }
            continue;
        }
        if (strcmp(command.left[0], "pwd") == 0) {
            if (count != 1) { fputs("usage: pwd\n", stderr); status = 2; continue; }
            char cwd[4096];
            if (getcwd(cwd, sizeof cwd) == NULL) { perror("pwd"); status = 1; }
            else { puts(cwd); status = 0; }
            continue;
        }
        status = launch(&command);
    }
}
