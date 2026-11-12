# 进阶实践01：从零为Shell加入追加输出

> **已完成的可选进阶实践。** 主线36章与第九批help练习保持原样。本篇先解释文件偏移，再把`>>`逐层接入一个独立Shell副本。建议8—12小时，另留2—3小时独立练习与报告。

## 1. 这一次只解决一个具体问题

第35章的`>`会创建或截断输出文件。如果你连续记录三次实验结果，第二次使用`>`会把第一次内容清掉。**追加输出**是在原文件内容之后继续写入；本篇新增`>>`，仍保留原`>`覆盖行为。

先修是第25—28章、第35章与第九批练习。学完应能解释两个独立打开的文件偏移，为Command增加状态，把解析结果传到open，并验证正常、错误和恢复。不要求安装新工具或开始内核实验。

本篇按三步完成：①两个fd的顺序实验；②解析、传参与打开标志的逐步改造；③完整副本与失败验收。之后可继续设计三段管道，但本次没有把未实现的后续题目算作完成。

## 2. 先分清覆盖、追加与保存

| 操作 | 已有内容 | 新输出 | 文件结果 |
| --- | --- | --- | --- |
| `echo second > note.txt` | first加换行 | second加换行 | 只剩second加换行 |
| `echo second >> note.txt` | first加换行 | second加换行 | first、second各一行 |
| `printf second >> note.txt` | first无换行 | second无换行 | firstsecond |

这些是**语义示例**，不是让你在原始资料目录执行的命令。追加不会自动补换行，也不会替应用区分记录。echo通常输出换行，本篇使用的外部printf在给定文本没有换行时不会自己添加。

追加、应用记录完整性和持久保存也不同。加了O_APPEND不会自动执行fsync，不意味着掉电后必然保留，不把两次write自动合成一个不可分割的业务事务。

## 3. open的三个标志先逐个读

`O_WRONLY`选择只写方式；`O_CREAT`表示不存在时允许创建；`O_TRUNC`用于本例覆盖模式，成功打开适用的已有文件时将其长度截为0。`O_APPEND`用于追加模式，每次write前按接口规则把写入位置安排到文件末尾。

本篇的两个选择是：覆盖用`O_WRONLY | O_CREAT | O_TRUNC`；追加用`O_WRONLY | O_CREAT | O_APPEND`。竖线在C表达式中是**按位或**，用于组合标志；它不是Shell管道。不要把O_TRUNC与O_APPEND一股脑都加上，否则“保留原内容”的目标已在打开时被破坏。

## 4. 文件末尾与fd偏移不是同一对象

文件包含一串字节，文件长度对应末尾位置。fd引用打开文件描述，后者保存当前偏移和状态标志。两次独立open通常得到两个独立的打开状态，即使都指向同一个文件，也不共享当前偏移；dup产生的关系又不同，见第26章。

```text
left fd  → 打开状态L（偏移L） → 同一个文件对象
right fd → 打开状态R（偏移R） ↗
```

如果right写了内容，文件长度可以改变，但left的当前偏移不会因为“文件变长”就自动实时更新为新EOF。O_APPEND影响下一次写入的定位，而不是让所有fd的偏移永久绑定在一起。

## 5. 手算A、B、C三次单字节写入

两个fd都从独立open得到，初始文件为空，按固定顺序left写A、right写B、left写C。下面是**顺序演算**，没有并发和随机调度。

| 模式与步骤 | 文件字节 | left偏移 | right偏移 |
| --- | --- | --- | --- |
| 普通，left写A | A | 1 | 0 |
| 普通，right写B | B | 1 | 1 |
| 普通，left写C | BC | 2 | 1 |
| 追加，left写A | A | 1 | 0 |
| 追加，right写B | AB | 1 | 2 |
| 追加，left写C | ABC | 3 | 2 |

普通模式第二次写从right的偏移0开始，所以覆盖A；追加模式每次写重新按当时文件末尾定位，所以得到ABC。第三次写完，right偏移仍是2，不会随left变成3。

## 6. 完整偏移实验程序

平台Linux/POSIX。保存为append-fds.c。本程序只接受一个新文件名，首次打开使用O_EXCL拒绝已有名字；因此重跑同名目标会失败。实验目录由你控制，运行期间没有其他修改者。

[完整源码：append-fds.c](进阶代码/append-fds.c)

```c
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

static int put_byte(int fd, unsigned char value) {
    ssize_t n;
    do { n = write(fd, &value, 1); } while (n < 0 && errno == EINTR);
    if (n < 0) { perror("write"); return -1; }
    if (n != 1) { fputs("write made no progress\n", stderr); return -1; }
    return 0;
}

static int positions(const char *step, int left, int right) {
    off_t a = lseek(left, 0, SEEK_CUR);
    if (a == (off_t)-1) { perror("left offset"); return -1; }
    off_t b = lseek(right, 0, SEEK_CUR);
    if (b == (off_t)-1) { perror("right offset"); return -1; }
    if (printf("%s left=%jd right=%jd\n", step, (intmax_t)a, (intmax_t)b) < 0) { return -1; }
    return 0;
}

int main(int argc, char **argv) {
    if (argc != 3 || (strcmp(argv[1], "plain") != 0 && strcmp(argv[1], "append") != 0)) {
        fputs("usage: append-fds plain|append NEW_FILE\n", stderr);
        return 2;
    }
    int left = -1, right = -1, result = 1;
    int extra = strcmp(argv[1], "append") == 0 ? O_APPEND : 0;
    left = open(argv[2], O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC | extra, 0600);
    if (left < 0) { perror("create new file"); goto done; }
    right = open(argv[2], O_WRONLY | O_NOFOLLOW | O_CLOEXEC | extra);
    if (right < 0) { perror("open second handle"); goto done; }
    if (put_byte(left, 'A') < 0 || positions("after-A", left, right) < 0) { goto done; }
    if (put_byte(right, 'B') < 0 || positions("after-B", left, right) < 0) { goto done; }
    if (put_byte(left, 'C') < 0 || positions("after-C", left, right) < 0) { goto done; }
    result = fflush(stdout) == EOF ? 1 : 0;
done:
    if (right >= 0 && close(right) < 0) { perror("close right"); result = 1; }
    if (left >= 0 && close(left) < 0) { perror("close left"); result = 1; }
    return result;
}
```

## 7. 新语法与资源收尾逐句解释

`extra`保存追加标志或0；组合时按位或0不会增加标志。left创建新文件，right独立打开相同路径；两者不使用dup，因此可观察各自偏移。`put_byte`只写一个字节，EINTR时重试，零进展作为错误，不能拿旧errno冒充当前原因。

`lseek(fd, 0, SEEK_CUR)`查询当前偏移，不改变它。返回类型是off_t，错误为`(off_t)-1`。为输出这个平台相关整数，程序转成intmax_t并用`%jd`打印；不要直接假设off_t一定对应`%d`。

任何失败都走done关闭当前已拥有的fd。失败时已经创建的文件会保留，便于观察部分结果；本程序没有回滚承诺。正常输出失败也会返回1；退出0说明所检查调用完成，不是掉电保证。

## 8. 保存和编译：先建独立目录

在**Ubuntu/WSL的Bash**执行：

```bash
mkdir -p ~/os-lab/shell-append
cd ~/os-lab/shell-append
```

从本页复制完整代码到`nano append-fds.c`并保存，或从下载包的`source/进阶代码/`复制同名文件到当前目录。只做一种保存方式，确认文件名相同。随后在**同一Bash目录**执行：

```bash
gcc -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -Werror append-fds.c -o append-fds
lab_dir=$(mktemp -d)
./append-fds plain "$lab_dir/plain.txt"
./append-fds append "$lab_dir/append.txt"
```

`mktemp -d`创建本次私有临时目录；变量只是保存它的路径，不属于系统配置。首次结果应与第5节的偏移表相同。不要为了让重跑成功删除自己不认识的已有文件，换一个新测试名字即可。

## 9. 看字节内容，再核对状态

仍在**同一Bash会话和目录**，复用lab_dir：

```bash
cat "$lab_dir/plain.txt"
printf '\n'
cat "$lab_dir/append.txt"
printf '\n'
./append-fds plain "$lab_dir/plain.txt"
echo $?
```

前两份文件分别为BC与ABC；为了终端显示清楚，外层printf额外输出换行，但它没有向文件添加换行。最后一次应报已有目标、状态1，文件内容保持BC，不会因为一次失败的演示被覆盖。

先预测再核对：after-A两种模式都是left=1、right=0；after-B开始不同；after-C追加模式right仍是2。若内容不对，先核对运行文件、模式参数和是否用了同一测试目录。

## 10. Shell改造先另存副本

保留第35章mini-shell.c与lab.h，在自己的练习目录复制：

```bash
cp -i -- mini-shell.c mini-shell-append.c
```

本段在**Ubuntu/WSL的Bash，已有两份基线文件的个人练习目录**执行。找不到文件时，先从原下载包`source/示例代码/`复制到这里；不要猜一个并不存在的下载路径。若目标已存在，确认是自己的什么版本再处理。

接下来修改mini-shell-append.c，主线文件保持可对照。本篇的完整参考版也保存在下载包`source/进阶代码/mini-shell-append.c`，可在手工尝试后核对。它从基线增加追加输出，不自动包含上一批独立help改造。

## 11. 第一处：执行计划需要记住追加选择

在`struct Command`内添加`int append;`，与has_pipe同层。它是一个用0或1表达的状态：0表示覆盖，1表示追加。原parse开头的memset已经把整份结构清零，所以没有重定向或使用`>`时默认不是追加。

这是**需要上下文的结构片段**，不能另存为完整程序：

```c
struct Command {
    char *left[MAX_ARGS];
    char *right[MAX_ARGS];
    char *output;
    int has_pipe;
    int append;
};
```

为什么不只在parse中创建一个局部变量？局部变量在parse返回后不自动传给执行层，必须把结果放入后续还能访问的执行计划。

## 12. 第二处：先识别操作符，再取文件名

原来的`if (strcmp(token, ">") == 0)`改成同时识别`>`与`>>`。在该分支内，原有重复输出、当前命令为空等检查保留；在读取下一token作为文件名前，记录当前token是否等于`>>`。

```c
if (strcmp(token, ">") == 0 || strcmp(token, ">>") == 0) {
    /* 保留原来的合法性检查。 */
    command->append = strcmp(token, ">>") == 0;
    /* 然后才取下一个token作为文件名。 */
}
```

以上是**控制流程片段**，省略处见完整源码。比较必须发生在token仍指向操作符时，不能先把token换成文件名，再问“文件名是否等于>>”。普通token的特殊字符拒绝规则仍保留，不能为了支持追加就放开任意`>`嵌入字符串。

## 13. 第三处：让打开函数明确选择标志

把函数签名改为`redirect_output(const char *name, int append)`，在原name为空直接返回之后选择：

```c
int flags = O_WRONLY | O_CREAT | (append ? O_APPEND : O_TRUNC);
int fd = open(name, flags, 0666);
```

这是**函数内部片段**。`条件 ? 值1 : 值2`表示按条件选择一个结果；append非0选择O_APPEND，否则O_TRUNC。已有的open失败、dup2失败和原fd关闭逻辑保留。0666还受umask等规则影响，不表示创建文件必定所有人可写。

不能把“追加”实现为open后lseek到EOF再普通write，就宣称具备O_APPEND的定位保证。独立的查EOF与后续写入之间仍可能有其他写入者，这一点在第18节手算。

## 14. 第四处：把状态从父计划传到子打开

| 位置 | 需要同步修改什么 |
| --- | --- |
| run_child函数声明 | 在filename后添加int append形参 |
| run_child内部调用 | 改为redirect_output(filename, append) |
| launch的左侧调用 | 传command->append，左侧管道没有filename所以不打开输出 |
| launch的右侧调用 | 传command->append，使用右侧输出目标 |

单命令时左侧就是实际执行者，负责文件输出；管道时右侧负责输出文件。一个标志要经历“解析得到 → 放入结构 → 传入子执行函数 → 传入打开函数”完整链路。只改函数定义、不改调用点，会在编译时报参数数量错误；只改解析、不改open则可能悄悄仍覆盖文件。

## 15. 完整参考版mini-shell-append.c

下面与下载文件一致，依赖同目录lab.h。建议先按上面四步改自己的副本，再逐段核对差异。原读入上限、NUL拒绝、内置组合限制、两侧启动和失败收尾沿用第35章。

[完整源码：mini-shell-append.c](进阶代码/mini-shell-append.c)

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
```

## 16. 编译后在小Shell内部执行验收

在**Ubuntu/WSL的Bash，存有mini-shell-append.c与lab.h的练习目录**执行：

```bash
gcc -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -Werror mini-shell-append.c -o mini-shell-append
mkdir -p append-shell-box
cd append-shell-box
../mini-shell-append
```

看到提示符后，下面在**mini-shell-append内部**逐行输入：

```text
echo first > note.txt
echo second >> note.txt
cat note.txt
printf abc | wc -c >> note.txt
cat note.txt
echo reset > note.txt
cat note.txt
exit
```

第一次cat应有first和second两行；第二次再有计数3的一行；最后只剩reset一行，说明`>`仍然覆盖。wc可能包含空白，按行的数值核对。回到Bash后`echo $?`应为0；小Shell内部仍不支持`$?`展开。

## 17. 失败输入要在打开文件之前拒绝

依次独立测试：`echo a >>`、`echo a >> x extra`、`echo a >>> x`、`echo a>>x`、`echo a >> x > y`、`pwd >> x`。它们都应状态2；语法或内置组合拒绝时不应创建x/y，更不应改变已有目标内容。

`echo a >> missing/file`语法合法，但目标目录不存在，应状态1；之后输入`echo recovered`仍应工作。若要查看某次错误的最终状态，错误后立即exit，再到Bash看`echo $?`；不要先执行成功恢复命令覆盖旧状态。

追加到已有只读普通文件，在本课普通用户权限条件下应打开失败、保留旧内容。可选权限实验只对自己的临时文件做，root或额外ACL等可能影响结果。失败发生前若已成功创建文件，空文件可能保留；不能把“返回失败”理解成自动回滚所有已发生步骤。

## 18. 为什么手工lseek与一次业务记录都不够

手算两个写入者：甲先查EOF为0，乙也查到0；甲按普通偏移写A，乙按自己仍为0的偏移写B。最终可能覆盖。把查EOF与write分成两次调用，没有让“定位到当时末尾并写入”成为同一操作。

O_APPEND为单次write提供相应定位与写入的原子步骤，不等于多次write合成的整条业务记录不可交错。短写后的重试仍是新的write；多个进程同时生成多段记录时，可能需要应用锁、协议或单写入者设计。实验只在受控本地Linux文件系统顺序验证，不把结果推广为所有远程文件系统保证。

改动练习：在append-fds最后一次写C之前，加入检查返回值的`lseek(left, 0, SEEK_SET)`。预测普通模式得到C，追加模式仍得到ABC。单独另存修改版再跑新名字；这说明追加定位作用于每次write，不是禁止所有lseek调用。

## 19. 独立练习与参考答案

**A：** 在printf输出之间没有换行，追加为什么没有新行？**参考答案：** 文件只增加程序真正输出的字节；`>>`不添加分隔符。

**B：** parse允许了>>，文件仍被清空，先查哪里？**参考答案：** 依次检查状态写入时机、Command字段、run_child传参和open标志，不只检查操作符比较。

**C：** 为支持追加，能否删除strpbrk的整个特殊字符拒绝？**参考答案：** 不能。应在明确分支识别独立操作符，其他受限语法仍按约定拒绝。

**D：** 原文件内容为old，输入`echo new >> note extra`，应先写new再拒绝extra吗？**参考答案：** 不应，应完整解析拒绝，旧文件不变。

**E：** O_APPEND是否让两个独立open的fd共享偏移？**参考答案：** 不会。观察第5节最后right仍为2；共享打开状态需要另外分析dup/fork等关系。

**F：** 能否据此宣称“多进程日志每条记录完整且掉电不丢”？**参考答案：** 不能。单次写入、记录协议和持久性是不同层面的要求，当前没有这类完整设计或实验。

## 20. 完成条件、记录与资料

完成条件：独立手算两种模式三次写入；编译偏移实验与Shell副本；解释四处状态传递；验证`>`、`>>`、管道追加、错误拒绝和恢复；提交实际文件内容与状态记录。主线36章仍为完整基线，本扩展不改变原来的学习进度和毕业最低要求。

资料核验日期：**2026-11-12**。打开与追加语义见[open(2)](https://man7.org/linux/man-pages/man2/open.2.html)，短写与单次操作边界见[write(2)](https://man7.org/linux/man-pages/man2/write.2.html)，偏移操作见[lseek(2)](https://man7.org/linux/man-pages/man2/lseek.2.html)。程序与教学解释为本课自行编写。

本扩展的程序、文件字节、错误路径和局限见 [验证记录](验证/验证记录.md)，工具脚本在 [verify-shell-append.py](验证/verify-shell-append.py)。先完成上面的实验，再读测试结果；不要把课程提供的日志直接当作自己的作业。
