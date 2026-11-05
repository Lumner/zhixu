# 35 综合项目：小型 Shell

> **旧版简稿 · 待详细重写。** 本章暂未达到零基础详细版标准。请优先学习已重写的01—16章，进度和后续批次见 [详细版学习指南](详细版学习指南与改写进度.md)。

## 35.1 项目目标和语法

先完成进程、文件、信号与错误处理。现在把独立实验组合成一个真正能运行的用户空间工具。主流程是“读一行 → 解析 → 处理内置命令或启动子进程 → 回收 → 继续”。

支持的输入为：`程序 参数...`，独立的 `cd 目录`、`pwd`、`exit`，一个 `左命令 | 右命令`，以及末尾 `> 输出文件`（也可用于管道右边）。操作符必须用空格分开，路径不能含空格或被拒绝的特殊字符。

`>` 会创建或截断你指定的输出文件，请只使用练习目录中的新名字。程序拒绝引号、反斜线、变量、通配符、重定向输入、后台、分号、括号等语法，不会把不支持的 Bash 表达式偷偷当普通参数继续执行。输入上限与参数数量也受限制。

## 35.2 为什么 cd 要在父进程做

chdir 改变调用它的进程的当前目录。若像外部命令一样 fork 后在子进程 cd，子进程退出后 Shell 自己的 cwd 没变，下一条命令仍从原目录解析。因此 cd、pwd、exit 在主循环处理。

为保持语义清楚，本项目内置命令只允许单独执行，不参加管道或重定向。完整 Shell 可以设计子 Shell 中的内置行为，但不能把教学限制当作 POSIX Shell 的全部规则。

## 35.3 先读五个组成部分

| 函数 | 负责的事情 | 核心边界 |
| --- | --- | --- |
| parse | 分割参数、识别单管道与末尾输出 | 拒绝不支持/不完整语法，数组留 NULL |
| redirect_output | 打开目标、dup2 到 stdout | 检查打开/复制失败 |
| run_child | 恢复信号、配置描述符、exec | 失败必须退出子进程 |
| launch | fork 一个或两个进程 | 两边启动后再等待，父关闭管道 |
| main | 主循环与内置命令 | 防超长输入，保留上一命令状态 |

parse 用 strtok_r 原地把空白替换成终止符，参数指针都指向 line；必须在下一次覆盖 line 前完成使用。父进程等待本次子进程完成后才继续读，满足该生命期约束。初始检查要求标准 fd 0/1/2 有效，从而 pipe 分配的编号不覆盖它们。

## 35.4 完整源码 mini-shell.c

[完整源码：mini-shell.c](示例代码/mini-shell.c)

```c
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
```

## 35.5 编译与逐步验收

在例程目录运行 `make mini-shell`、`./mini-shell`。交互终端会显示 `os-lab>` 提示，输入下列各行（进入临时练习目录后再重定向）：

```text
pwd
echo hello
printf abc | wc -c
echo saved > shell-output-demo.txt
cat shell-output-demo.txt
cd ..
pwd
no_such_os_lab_command
exit
```

echo 输出 hello；管道计算三个字节，wc 输出 3（可含前导空格）；重定向后 cat 显示 saved；cd 后 pwd 应改变；不存在命令打印错误，exit 返回上一命令状态，按此顺序为 127。若中间再运行成功命令，exit 返回值相应更新。

再测 `echo a |`、`echo a | wc -c | wc -c`、`echo "a b"`、`pwd > x`，应被拒绝。不要把受限语法拒绝误认为 exec 或 Linux 不支持这些功能。

## 35.6 资源与异常路径

管道两端必须并发启动；若先 wait 左边再创建右边，大输出可能把管道写满而永久等待。父进程启动两边后关闭自己两端，再等待回收。管道退出状态采用右侧命令结果，这是一项明确约定，不实现 pipefail。

父 Shell 忽略 SIGINT，子进程恢复默认处理。项目未设置完整进程组与终端控制，在正常前台运行时用于展示基本信号行为；嵌套前后台作业、暂停恢复、行编辑属于后续项目。用户按 Ctrl+C 空提示时也没有完整 Shell 那样的提示行重绘。

## 35.7 改造练习与完成条件

①加入 `help`：在父分支输出支持语法并将其纳入内置识别。②支持追加 `>>`：在解析层增加明确标志，打开层改为 O_APPEND，先写验收输入。③支持多级管道：先设计每个子进程与 fd 的矩阵，再创建 N−1 条管道，所有无用端都关闭。

完成条件：能解释每个 fork 分支，每个打开描述符的关闭位置，以及语法错误、找不到程序、输出文件失败和正常退出的不同结果。配套自动检查见 [验证目录](验证/验证记录.md)。
