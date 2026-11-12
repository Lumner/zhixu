# 35 综合项目：小型 Shell

> **零基础详细版 · 已重写。** 先修：第11—15章、第25—28章及第34章。建议12—17小时，至少拆成五次动手。本章从最小启动器开始，最终组合成受限语法的前台命令工具。

## 35.1 学习目标与最后要交什么

Shell是读取命令并组织执行的用户空间程序。Bash功能很多，本章只做一个可以解释完整生命周期的小版本：读取一行、检查语法、处理内置命令或启动外部程序、回收子进程、记录状态、继续下一行。

最终交付源码、编译命令、功能矩阵和失败记录。能输出`hello`只是第一步；你还要解释每个fd由谁拥有，为什么EOF会出现，子进程失败后父进程如何继续。不要把自己编写的小Shell替换成系统登录Shell。

## 35.2 先约定输入，才开始解析

支持：外部`程序 参数...`；独立的`cd 目录`、`pwd`、`exit`；一个两段管道；末尾一次输出重定向。`|`与`>`必须由空白分开；一行最多1023个非换行字节，每侧最多63个token，其中第一个是程序名。

```text
printf abc | wc -c > count.txt
```

这条命令允许。引号、反斜线、变量、通配符、输入重定向、追加、后台、分号等不支持；含这些特殊符号的token会被拒绝。文件路径不能含空白或被禁止的字符，输入必须是无NUL的文本。它不是完整POSIX Shell语法，不能把Bash脚本直接交给它。

## 35.3 五个增量版本，各解决一个问题

| 步骤 | 先完成什么 | 验收问题 |
| --- | --- | --- |
| 1 最小启动器 | 直接使用现成argv启动一个程序 | fork与exec分支能否解释 |
| 2 读取和解析 | 将一行拆成有界参数数组 | 空行、上限和错误是否明确 |
| 3 内置命令 | 在父进程改变目录与退出 | cd后下一条命令目录是否改变 |
| 4 两段管道 | 同时启动两侧并关闭无用端 | 大输出能否完成并得到EOF |
| 5 输出文件 | 右侧输出指向新文件 | 打开失败、覆盖与返回值是否明确 |

每一步只加入一个主要机制。最终完整代码在35.15节；第一次阅读先做启动器和纸面fd表，不必马上把整份代码背下来。

## 35.4 完整最小启动器：先不解析命令行

平台Linux/POSIX，保存为`run-one.c`。这是单次启动器，参数由外层Bash提供，尚不是交互Shell。

**完整程序：run-one.c**

```c
#include <errno.h>
#include <stdio.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

int main(int argc, char **argv) {
    if (argc < 2) { fputs("usage: run-one PROGRAM [ARG...]\n", stderr); return 2; }
    pid_t child = fork();
    if (child < 0) { perror("fork"); return 1; }
    if (child == 0) {
        execvp(argv[1], argv + 1);
        int code = errno == ENOENT ? 127 : 126;
        perror("execvp");
        _exit(code);
    }
    int status;
    while (waitpid(child, &status, 0) < 0) {
        if (errno == EINTR) { continue; }
        perror("waitpid"); return 1;
    }
    int code = 1;
    if (WIFEXITED(status)) { code = WEXITSTATUS(status); }
    else if (WIFSIGNALED(status)) { code = 128 + WTERMSIG(status); }
    if (printf("child_status=%d\n", code) < 0 || fflush(stdout) == EOF) { return 1; }
    return code;
}
```

`argv + 1`从原参数数组的第二个指针开始：原`argv[1]`成为新程序的`argv[0]`，末尾原有NULL继续有效。exec成功不会回到后面的perror；失败保存errno对应状态，再退出子进程。父进程只wait自己创建的child。

## 35.5 编译第一步并区分两层终端

在**Ubuntu/WSL的Bash，`~/os-lab/batch09`目录**保存源码并执行：

```bash
gcc -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -Werror run-one.c -o run-one
./run-one printf abc
echo $?
./run-one no_such_os_lab_command
echo $?
```

第一组输出`abcchild_status=0`并换行，因为外部printf本身没有输出换行；最后Bash显示0。第二组有错误诊断和`child_status=127`，Bash随后显示127。想让正文与状态分行，可把命令改为外部`echo hello`。

这里的`echo $?`由外层Bash解释。稍后进入mini-shell后不支持`$?`展开；要观察它的最终退出状态，需要先在mini-shell输入`exit`，返回Bash后再运行`echo $?`。教材中的终端层次不能混用。

## 35.6 参数数组怎样对应原输入

最终程序用`struct Command`保存两组`char *`数组、一份输出文件名指针与has_pipe标志。对示例命令解析后，应画成：

```text
left  → ["printf", "abc", NULL]
right → ["wc", "-c", NULL]
output→ "count.txt"
has_pipe = 1
```

字符串仍在原来的line数组里，结构体主要保存指向它们的指针，没有复制所有字符。父进程在本次子进程完成前不覆盖line；fork后子进程也有相应地址空间内容。下一次读入会改写父进程line，所以不能把这些指针长期保存给未来任务使用。

## 35.7 strtok_r与原地切分先手算

`strtok_r`寻找由空白分开的token，把分隔位置改成NUL，并用state保存继续位置。第一次传line，随后传NULL表示继续。它不是引号解析器，本项目先明确拒绝不支持的符号，不能指望它自动理解`"a b"`。

请在纸上把`echo a | wc -c`写成字符格子，把空格替换为`\0`，再画指向e、a、竖线、w和减号的五个指针。`memset(command, 0, sizeof *command)`先将数组元素清零，因此正常填充后仍有NULL结束项；容量检查必须为这个NULL保留位置。

## 35.8 用状态而不是猜测识别操作符

parse最初向left添加token。遇到独立`|`时，要求左边已有命令、尚无管道、也没有提前输出目标，再转入right。遇到`>`时要求当前侧已有命令、还没有输出目标，下一token必须是合法文件名，随后不能再有token。

所以`| wc`、`echo a |`、第二个管道、缺少文件名、`> x`后还有内容都拒绝。解析结束后才启动子进程或打开输出文件，避免明显语法错误先产生执行副作用。但合法语法中的重定向可能在exec失败前已创建或截断文件，这属于本项目的执行顺序，使用新测试文件。

## 35.9 输入边界：读完整一行再决定

完整程序的`read_line`逐字节读取，最多保存1023字节并添加NUL；达到容量或遇到原始NUL后，继续消耗本行直到换行或EOF，再统一拒绝。这样超长行的剩余内容不会被误认成下一条命令。

返回约定：1是一条有效文本记录；0是没有新记录的EOF；-1是输入I/O错误；-2是超长或含NUL。空白行有效但不执行命令，最后一行没有换行也可处理。主程序将stdin设为无缓冲，避免提前读取本应留给外部命令的输入；这使教学脚本语义更直接，不作为高吞吐解析方案。读取遇到EINTR清除流错误再试；其他错误退出。这里限制的是字节数，不是屏幕上的汉字数量。

## 35.10 cd为什么必须由父进程执行

`chdir`只改变调用进程的当前目录。若父Shell fork后让子进程cd，子进程退出，父Shell目录仍是原处。下一条相对路径命令由父Shell启动，因此不会继承一个已退出子进程的目录变化。

本项目将cd、pwd、exit统称内置命令，在父主循环处理；内置命令只允许独立执行，不参加管道或重定向。完整Shell有更丰富的子Shell语义，但那不在这里。`exit`不接数字参数，返回最近一次命令状态；正确空行不会把原状态改成0。

## 35.11 单个外部命令：分清父子职责

launch先刷新父进程输出缓冲，再fork。父进程等待child完成，随后继续读输入；子进程设置描述符并execvp。若误让父进程exec，Shell自身会被替换，下一行主循环不会再执行。

exec失败时本项目约定ENOENT映射127，其他执行错误映射126；退出或被信号终止时，wait_child解码状态。ENOENT也可能来自可执行文件依赖的解释器等缺失，所以127不能精确诊断成“用户只拼错了程序名”。这些数值是工具的状态约定，不是errno本身。

## 35.12 管道必须让两侧都有机会前进

```text
父：pipe → fork左 → fork右 → 关闭自己两端 → wait左 → wait右
左：stdout复制为管道写端 → 关闭管道原fd → exec左命令
右：stdin复制为管道读端 → 关闭管道原fd → exec右命令
```

如果先等左侧退出再创建右侧，大输出可能写满管道：左等读者、父等左、读者还没创建。正确顺序先启动两侧。父进程随后先wait左并不阻止右运行，因为右已经存在；调度器会安排它们执行。

管道最终状态取右侧命令。本项目不实现pipefail，因此左失败但右成功时结果可为0。两边都需要回收，不可只wait右侧后留下左侧僵尸。

## 35.13 描述符表与输出重定向

以`printf abc | wc -c > count.txt`为例：左进程的fd1指向管道写端；右进程fd0指向读端，fd1再经open和dup2指向输出文件；父保留自己的标准输入输出。复制成功后关闭原fd，不会撤销已经复制的新引用。

输出打开使用`O_WRONLY | O_CREAT | O_TRUNC`，创建权限还受umask等影响。输出是普通保存，不额外执行fsync；看到文件内容正确不证明掉电后必然保留。打开或dup2失败时子进程退出1，父进程回收并继续主循环。

## 35.14 资源失败时先完成收尾

pipe失败时没有新子进程；第一次fork失败时关闭已建管道；第二次fork失败时，先关闭父持有的两端，对这次创建的左侧直接子进程发送SIGKILL并回收，返回1。不能仅等待一个可能正在sleep的左命令直到任意时刻。

这里只终止自己尚未回收的直接child，PID不会在被回收前随意代表另一个新进程。没有实现进程组，不保证清理外部命令自行创建的全部后代。一般wait异常由公共辅助函数报告并结束当前工具；教材测试只模拟已说明的失败，不能称覆盖了所有操作系统故障。

## 35.15 完整基线源码

以下是最终版本，与下载包文件一致。先把`mini-shell.c`和[公共lab.h说明](示例代码/README.md)中的lab.h放在同一目录；辅助函数die、wait_child的具体解释见第11—12章。

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
                  command->has_pipe ? NULL : command->output);
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
    if (second == 0) { run_child(command->right, fd[0], -1, fd, command->output); }
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
```

## 35.16 编译并做第一轮正常验收

在**Ubuntu/WSL的Bash，包含mini-shell.c与lab.h的练习目录**执行；不要在需要保留的资料目录做重定向实验。

```bash
gcc -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -Werror mini-shell.c -o mini-shell
mkdir -p shell-box
cd shell-box
../mini-shell
```

看到`os-lab>`后，下面各行在**mini-shell内**输入，不带提示符：

```text
pwd
echo hello
printf abc | wc -c
echo saved > result.txt
cat result.txt
printf abc | wc -c > count.txt
cat count.txt
exit
```

应分别看到当前目录、hello、3、saved和文件中的3；wc可能带空白，按数值核对。回到Bash后`echo $?`应为0。因为非交互输入不显示提示符，自动测试中的输出会更简洁，两种运行方式不要混淆。

## 35.17 失败、恢复与边界验收

重新进入mini-shell，逐条测试：不存在命令；`echo a |`；`echo a|wc`；`echo "a b"`；`pwd > x`；`echo a > missing/file`。分别对应执行失败、语法拒绝、不支持粘连操作符、不支持引号、内置组合拒绝、文件打开失败。

每次失败后输入`echo recovered`应仍可工作；如果要检查前一失败的最终状态，应立即输入exit再回Bash检查，别先执行成功命令把状态覆盖。测试目录中创建一个无执行权限的普通文件再作为程序运行，应状态126；找不到命令为127；非法语法为2；普通资源错误为1。

容量题：63个token可以接受，64个拒绝；1023个非换行字节可作为一行，1024个拒绝并丢弃余下内容。输入中NUL属于非法记录；自动验证使用二进制管道构造，手工终端无需尝试键入NUL。

## 35.18 信号、交互与能力限制

父Shell忽略SIGINT，子进程恢复SIGINT默认处理；在正常前台终端中可体现“打断子任务后父仍存在”。程序没有完整进程组管理、暂停恢复、行编辑或提示行重绘，不是能安全替换Bash的交互环境。

不要把自动向自己子进程组发送SIGINT的测试写成“已验证所有终端Ctrl+C行为”；两者涉及的终端路径不同。还要记住PATH与工作目录决定执行来源，本工具用于自己控制的课程实验，不提供远程不可信命令服务。

## 35.19 练习、参考答案与完成条件

**A：** 父进程忘记关管道写端会怎样？**参考答案：** 右侧即使读完左侧数据，也可能因仍有写引用而等不到EOF。

**B：** 左进程exit7，右进程exit0，最终状态是多少？**参考答案：** 本项目采用右侧状态0；没有pipefail。

**C：** 在子进程chdir后再回父主循环能完成cd吗？**参考答案：** 不能，必须让父进程自身改变cwd，或另行设计环境语义。

**D：** 为什么read_line发现超长后还继续读本行？**参考答案：** 防止尾部成为新命令，必须保持输入记录边界。

**E：** 能否删去全部close，因为进程最终退出？**参考答案：** 不能。退出前的引用就会影响EOF与阻塞，父Shell还会长期继续运行。

完成条件：独立画一条管道加重定向的fd矩阵；逐个解释完整代码的fork分支和失败收尾；完成正常、错误、恢复、容量测试；再做 [第九批改造与毕业练习](详写第九批-练习与参考答案.md)。

## 35.20 官方资料与实际验证范围

资料核验日期：**2026-11-12**。程序替换依据[execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html)，状态回收依据[waitpid(2)](https://man7.org/linux/man-pages/man2/waitpid.2.html)，描述符与管道概念延续第14章。实现与语法为本课自行设计，不宣称符合完整Shell标准。

实际测试包括大输出管道、文本/NUL/容量边界和资源失败；未测试的终端作业控制、外部命令全部后代管理和真实存储掉电保证在 [验证记录](验证/验证记录.md)中单列。测试通过是所覆盖行为的证据，不代替你逐步解释代码。
