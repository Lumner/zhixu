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
    int append;
};

/* Consume one whole text record; reject embedded NUL and oversized records. */
static int read_line(char *line, size_t capacity) {
    size_t used = 0;
    int invalid = 0;
    for (;;) {
        int ch = getchar();
        if (ch == EOF && ferror(stdin)) {
            if (errno == EINTR) { clearerr(stdin); continue; }
            perror("input"); return -1;
        }
        if (ch == EOF && used == 0 && !invalid) { return 0; }
        if (ch == '\n' || ch == EOF) {
            line[used] = '\0';
            return invalid ? -2 : 1;
        }
        if (ch == '\0') { invalid = 1; }
        if (used < capacity - 1) { line[used++] = (char)ch; }
        else { invalid = 1; }
    }
}

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
        if (strcmp(token, ">") == 0 || strcmp(token, ">>") == 0) {
            if (command->output || (command->has_pipe ? right_count : left_count) == 0) {
                return -1;
            }
            command->append = strcmp(token, ">>") == 0;
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

static void redirect_output(const char *name, int append) {
    if (name == NULL) { return; }
    int flags = O_WRONLY | O_CREAT | (append ? O_APPEND : O_TRUNC);
    int fd = open(name, flags, 0666);
    if (fd < 0) { perror("open output"); _exit(1); }
    if (dup2(fd, STDOUT_FILENO) < 0) { perror("dup2 output"); _exit(1); }
    if (fd != STDOUT_FILENO) { close(fd); }
}

static void run_child(char *const args[], int input, int output,
                      const int pipefd[2], const char *filename, int append) {
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
    redirect_output(filename, append);
    execvp(args[0], args);
    int code = errno == ENOENT ? 127 : 126;
    perror(args[0]);
    _exit(code);
}

static int launch(struct Command *command) {
    int fd[2] = {-1, -1};
    if (command->has_pipe && pipe(fd) < 0) { perror("pipe"); return 1; }
    if (fflush(NULL) == EOF) {
        perror("flush");
        if (command->has_pipe) { close(fd[0]); close(fd[1]); }
        return 1;
    }
    pid_t first = fork();
    if (first < 0) {
        perror("fork");
        if (command->has_pipe) { close(fd[0]); close(fd[1]); }
        return 1;
    }
    if (first == 0) {
        run_child(command->left, -1, command->has_pipe ? fd[1] : -1,
                  command->has_pipe ? fd : NULL,
                  command->has_pipe ? NULL : command->output, command->append);
    }
    if (!command->has_pipe) { return wait_child(first); }
    pid_t second = fork();
    if (second < 0) {
        perror("fork second");
        close(fd[0]); close(fd[1]);
        /* Only the child created by this launch is targeted. */
        if (kill(first, SIGKILL) < 0 && errno != ESRCH) { perror("kill child"); }
        (void)wait_child(first);
        return 1;
    }
    if (second == 0) { run_child(command->right, fd[0], -1, fd, command->output, command->append); }
    close(fd[0]); close(fd[1]);
    (void)wait_child(first);
    return wait_child(second);
}

int main(void) {
    /* Require normal standard descriptors; pipe descriptors are then >= 3. */
    for (int fd = 0; fd <= 2; fd++) { if (fcntl(fd, F_GETFD) < 0) { return 1; } }
    /* Do not prefetch bytes that an external command may read from stdin. */
    if (setvbuf(stdin, NULL, _IONBF, 0) != 0) { return 1; }
    struct sigaction action = {0};
    action.sa_handler = SIG_IGN;
    sigemptyset(&action.sa_mask);
    if (sigaction(SIGINT, &action, NULL) < 0) { die("sigaction"); }
    int status = 0;
    char line[MAX_LINE];
    for (;;) {
        if (isatty(STDIN_FILENO) &&
            (fputs("os-lab> ", stdout) == EOF || fflush(stdout) == EOF)) { return 1; }
        int input = read_line(line, sizeof line);
        if (input == 0) { return status; }
        if (input == -1) { return 1; }
        if (input == -2) {
            fputs("line too long or contains NUL\n", stderr);
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
            else { status = (puts(cwd) == EOF || fflush(stdout) == EOF) ? 1 : 0; }
            continue;
        }
        status = launch(&command);
    }
}
