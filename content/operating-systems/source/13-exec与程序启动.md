# 13 exec与程序启动：保留进程，换一份程序

> **零基础详细版 · 已重写。** 本章从参数数组开始，观察exec前后PID，再完成一个可运行外部命令的最小命令器。建议6—8小时。

## 1. 本章解决什么问题

第12章的子进程仍执行父进程程序里的代码。如果希望它运行`printf`、`wc`或自己编译的另一个程序，如何做到？答案是先理解**替换进程映像**：保留这个进程的身份，装入另一份程序的代码与数据，从新程序入口开始执行。

学完应能解释fork与exec的职责，手写以NULL结尾的参数向量，识别exec成功与失败的控制流，说明PATH和Shell分别做什么。先复习第07章字符串、第08章指针数组、第12章等待与`_exit`。

## 2. 一次启动往往分成三步

| 步骤 | 谁执行 | 作用 |
| --- | --- | --- |
| fork | 原进程 | 创建孩子，保留自己继续管理 |
| exec | 孩子 | 用目标程序替换自己当前运行的程序 |
| wait | 父亲 | 等待孩子结束并收取结果 |

exec本身不再额外创建一个进程。成功后，调用者的PID保持不变，普通代码和数据等进程映像被替换；原来程序的局部变量不能继续拿来使用。文件描述符等某些资源按接口规则保留，第14章再连接这一点。

也可以不fork，当前进程直接exec，这样原程序成功替换后就没有机会回来做后续管理。本章为了观察两个角色，主要使用先fork再exec。

## 3. 先认识argc和argv

C的常见入口形式`int main(int argc, char *argv[])`接收命令行参数。`argc`是参数个数，`argv`是指向字符串的指针数组。`argv[argc]`是空指针，标记向量结束。

**完整程序：argv-view.c**

```c
#include <stdio.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    printf("target pid=%ld argc=%d\n", (long)getpid(), argc);
    for (int i = 0; i < argc; i++) {
        printf("argv[%d]=<%s>\n", i, argv[i]);
    }
    if (fflush(stdout) == EOF) {
        perror("fflush");
        return 1;
    }
    return 0;
}
```

Linux/WSL Bash中，在`~/os-lab/processes`保存并编译：

```bash
gcc -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -Werror -g argv-view.c -o argv-view
./argv-view alpha 'two words'
```

PID随运行变化；`argc=3`，三个参数依次是`./argv-view`、`alpha`、`two words`。单引号由启动它的Shell处理，使两个单词组成一个参数；引号本身没有成为字符串内容。

## 4. 指针数组逐格看

这是**概念图**：

```text
argv[0] → "./argv-view\0"
argv[1] → "alpha\0"
argv[2] → "two words\0"
argv[3] → NULL
```

每个字符串自己的`\0`与整个指针数组末尾的`NULL`不是一回事。前者是字符值0，结束一条字符串；后者表示没有下一个字符串指针。exec既需要读每条字符串，也需要知道整个参数列表在哪结束。

`argv[0]`按惯例填写程序名，但它只是传给目标程序的第一个参数；确定要执行哪个文件的是exec的路径参数。程序可以检查它，但不要把它误当作可信的真实路径证明。

## 5. 主线：孩子被printf程序替换

同目录中需要`lab.h`。

[完整源码：execute.c](示例代码/execute.c)

```c
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
```

按上一节选项编译`execute.c -o execute`再执行。正常结果为：

```text
exec replaced the child
exit=0
```

这里启动的是PATH里可执行的`printf`程序，不是让一个新Shell去解释整行文本。原来的子进程代码在exec成功后消失，所以后面的`perror`不会执行；父进程仍保留自己的代码，等待后打印`exit=0`。

## 6. exec成功为什么没有返回值给我们

这类exec接口**成功时不返回**，因为旧程序已经被替换；失败时返回-1，旧程序仍在执行，可以读取`errno`并清理。

因此常见结构是“调用exec；紧接着写失败处理”。不用写`if (execvp(...) == 0)`期待成功分支。也不能在exec后写一句“程序启动成功”来作为成功提示，因为那句只会在失败后有机会运行。

这个规则和fork不同：fork成功后有两条返回路径；exec成功后没有回到旧调用点的路径。把两者画成不同箭头，比只背函数名有效。

## 7. 对照实验：exec前后PID相同

先确保上一节的`argv-view`已编译并位于当前目录。

**完整程序：exec-same-pid.c**

```c
#include "lab.h"

int main(void) {
    if (fflush(NULL) == EOF) { die("fflush"); }
    pid_t child = fork();
    if (child < 0) { die("fork"); }
    if (child == 0) {
        printf("before_exec_pid=%ld\n", (long)getpid());
        if (fflush(stdout) == EOF) { _exit(1); }
        char *args[] = {"argv-view", "alpha", "two words", NULL};
        execv("./argv-view", args);
        perror("execv");
        _exit(127);
    }
    int code = wait_child(child);
    printf("parent observed child_exit=%d\n", code);
    return code;
}
```

编译为`exec-same-pid`并运行。记录`before_exec_pid`和目标程序打印的`target pid`，它们必须相等。`target argc=3`，`argv[0]`这次是我们传入的`argv-view`，不会自动加上`./`。

在`execv`前的刷新保证“替换以前”的文字已经送出，不依赖旧缓冲在新程序里继续存在。目标程序输出完成后退出，父进程最后打印观察到的退出状态。

## 8. v、p这些字母表示什么

| 接口 | 怎样提供参数 | 怎样找到文件 |
| --- | --- | --- |
| execv | 字符串指针向量 | 使用指定路径 |
| execvp | 字符串指针向量 | 文件名没有斜杠时按PATH搜索 |

`v`可以联想vector，即向量；`p`对应PATH搜索。exec系列还有其他成员，本章不一次背全。

`execv("./argv-view", args)`明确指定当前目录下的文件。`execvp("argv-view", args)`是否找到它，取决于PATH；当前目录通常并未自动包含在PATH中。所以自己编译的程序习惯用`./程序名`启动。

## 9. PATH不是文件存放清单

**环境变量**是进程启动时获得的一组名字和值。PATH是其中一个，用冒号分隔若干搜索目录。在Linux Bash执行：

```bash
printf '%s\n' "$PATH"
command -v printf
```

Shell的`command -v printf`可能报告内建命令；这不等于证明exec调用了内建函数。exec需要可执行文件，Shell内建功能属于Shell本身。若要观察外部文件路径，可以查看系统中实际存在的`/usr/bin/printf`，但不要假设所有平台都装在相同目录。

本课只用自己控制的参数和路径。PATH可以影响同名程序最终指向哪里；遇到“为什么运行的不是我刚编译的程序”，先检查是否使用了`./`、当前目录与真实文件。

## 10. 把命令行参数交给孩子

**完整程序：run-command.c**

```c
#include "lab.h"

int main(int argc, char *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "usage: %s PROGRAM [ARG ...]\n", argv[0]);
        return 2;
    }
    if (fflush(NULL) == EOF) { die("fflush"); }
    pid_t child = fork();
    if (child < 0) { die("fork"); }
    if (child == 0) {
        execvp(argv[1], &argv[1]);
        perror("execvp");
        _exit(127);
    }
    int code = wait_child(child);
    fprintf(stderr, "child_exit=%d\n", code);
    return code;
}
```

编译为`run-command`。在本批目录依次运行：

```bash
./run-command ./argv-view hello 'one argument'
./run-command
echo $?
./run-command ./this-file-does-not-exist
echo $?
```

第一条目标收到3个参数；第二条没有程序名，显示用法并退出2；第三条孩子exec失败，打印错误，父亲打印`child_exit=127`并退出127。失败路径不能继续落到父进程的等待代码，所以孩子用`_exit`结束。

## 11. 为什么&argv[1]就够了

启动命令器时：

```text
argv[0] → "./run-command"
argv[1] → "./argv-view"
argv[2] → "hello"
argv[3] → "one argument"
argv[4] → NULL
```

`&argv[1]`指向数组中第二格的地址。exec从那里看过去，得到一个新的逻辑向量：程序名、hello、one argument、NULL。尾部原本就有NULL，所以不需要在本例里复制所有字符串。

这依赖参数数组在调用期间仍有效；没有把临时局部数组的悬空地址传出去。复习第08章时可以把`argv`想成一排“装地址的格子”，而不是连续存放所有文本的一个字符数组。

## 12. 它还不是一个Shell

执行：

```bash
./run-command ./argv-view '>' output.txt
```

目标程序收到字面参数`>`和`output.txt`，命令器不会主动创建输出文件。因为这里的`>`被引号保护，外层Shell没有把它作为重定向符；exec本身也不解析这种Shell语法。

反过来，`./run-command ./argv-view > output.txt`里的重定向由**启动命令器的外层Shell**先完成，命令器和孩子继承相应输出目标。第14章会自己实现受控的描述符重定向。

同理，把`"printf hello | wc -c"`当作一个字符串交给execvp，不会自动组成管道；它会被当作一个文件名。空格、管道、变量展开、通配符和引号处理都属于另一层解析规则。需要Shell时必须有明确设计，不能隐式猜测。

## 13. 为什么诊断输出到stderr

目标程序的标准输出可能正被导出为数据文件。命令器若把`child_exit=0`混入标准输出，会污染本来只该有数据的结果。所以`run-command`把管理信息写到标准错误。

在本批目录执行：

```bash
./run-command ./argv-view demo > args.txt
cat args.txt
```

终端仍能看到`child_exit=0`，`args.txt`只含目标程序正文。这里`>`会覆盖同名文件，练习时只使用自己建立的测试文件名；第14章自己的程序将采用拒绝覆盖的新文件接口。

## 14. 失败码127是谁决定的

本课命令器把所有exec失败都映射为127，这是教学程序的选择。没有此文件、没有执行权限等不同错误可以由`perror`解释，但程序暂未实现完整Shell区分126/127的行为。

目标程序自己也可以退出127，所以只看到父亲取得127，不能单凭数字断言exec必定失败。需要结合失败诊断或设计专门的错误报告通道。本章保留简单接口；不谎称一个退出码就覆盖了全部启动协议。

## 15. 权限错误怎样做可控实验

在本批练习目录创建一个自己的普通文本文件`not-executable.txt`，里面写`practice`，并确保它没有执行权限：

```bash
chmod a-x not-executable.txt
./run-command ./not-executable.txt
echo $?
```

预期exec失败，退出127；错误文字与权限、挂载等环境有关。只改自己创建的这个测试文件，不对系统命令改权限。不要用给所有文件加`777`来“解决”路径或可执行格式问题。

权限允许也不代表任意文件都能作为本课的二进制程序执行；可执行格式、解释器、平台架构还需要匹配。运行自己的C编译产物最容易排除这些额外因素。

## 16. 成功继承什么、替换什么

本章先记三件事：PID保留；旧程序的普通代码与数据被新映像替换；某些进程资源按规则继承。已经打开且没有设置close-on-exec标志的描述符通常会保留，所以可以在exec前把1接到管道，再让完全不认识管道的目标程序照常写标准输出。

**close-on-exec**是“成功exec时自动关闭这个描述符”的标志，帮助避免不必要资源泄漏。它不是`close`立即关闭，也不是“exec后关闭整个进程”。本批用明确的close管理有限端点；后面的Shell实践再扩展更完整的描述符管理。

## 17. 排错顺序

先看命令器是否有传入程序名；再看源码编译是否成功；随后确认路径、权限和平台；最后确认参数向量是否以NULL结束。`execvp`的错误路径应打印诊断并立即结束孩子，父亲继续收回状态。

若目标参数不对，先运行`argv-view`观察每格内容，尤其检查引号是否在外层被处理。如果PID不相同，确认比较的是孩子exec前后，而不是父亲与孩子。若输出重复，回到第12章检查fork前的缓冲。

## 18. 练习、提示与参考答案

1. 把`exec-same-pid`中的`alpha`改为`first`，再增加一个`last`，参数个数应是多少？提示：别忘`argv[0]`。
2. `execvp`成功后，紧跟着的`perror`会不会执行？失败后会不会自动结束进程？
3. `run-command`为什么先判断`argc < 2`？不判断会有什么接口问题？
4. `execv("./argv-view", args)`中把`args[0]`改为`"demo-name"`，实际执行文件改变吗？
5. 要取得目标程序的退出结果，应该依赖exec返回还是父进程的wait？

参考答案：第一题argc=4，四项为argv-view、first、two words、last；第二题成功不执行，失败仍在旧程序中，必须自己处理；第三题避免把缺失的程序参数作为路径使用；第四题仍执行指定文件，但目标看到的argv[0]变为demo-name；第五题通过等待取得，exec成功本身没有返回到旧程序。

动手练习：编译一个只`return 7;`的小程序`exit-seven.c`，用`run-command ./exit-seven`运行。参考结果是目标不打印正文，父亲在标准错误报告`child_exit=7`，命令器退出7。自行写出这三层结果，不把“屏幕没有内容”当作未执行。

## 19. 完成条件与资料

能画出fork/exec/wait三步角色，解释两个终止符，验证同一孩子exec前后PID不变，运行成功、缺参数、路径错误和权限错误案例，并说明最小命令器与Shell解析的边界。

接口依据[exec(3)](https://man7.org/linux/man-pages/man3/exec.3.html)、[execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html)，核验2026-11-05。下一章：[描述符、管道与重定向](14-描述符管道与重定向.md)。
