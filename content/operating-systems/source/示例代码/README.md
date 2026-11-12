# 系统实验台：完整例程与运行说明

## 平台与准备

这些程序面向 Linux/POSIX，使用 C17。Windows 用户请在 WSL Ubuntu 的 Bash 编译运行，不在 Windows MinGW 中运行 fork 示例。依赖 GCC/兼容 C 编译器、Make 与常见 Linux 工具；安装步骤见 [第 02 章](../02-Linux环境与终端.md)。所有 `.c`、`lab.h`、Makefile 放在同一目录。

在本目录运行：

```bash
make all
./hello
./process
./queue
./mini-shell
```

`make all` 会在本目录生成可执行文件，源码文件不改变。自动验收脚本则在临时目录编译和运行，避免把二进制与临时数据混入教材。

## 23 个例程与章节

| 文件（不含 .c） | 对应章 | 主要预期 |
| --- | --- | --- |
| hello | 03 | Hello, operating systems! |
| minutes | 04 | 输入90得到1h30min，拒绝非法输入 |
| control | 05 | total=250 |
| functions | 06 | sum=90 |
| arrays | 07 | count=4 sum=120 length=6 |
| pointers | 08 | before=10,20，after=20,10 |
| records | 09 | records=3 total=60 |
| copy | 10 | 源与新目标逐字节一致，拒绝覆盖既有目标 |
| syswrite | 11 | write reaches fd 1 |
| process | 12、21 | 子99、父10、子退出7 |
| execute | 13 | exec replaced the child，exit=0 |
| pipe-demo | 14 | hello through pipe |
| signal-demo | 15 | SIGINT 后 stopped safely |
| scheduling | 16 | FCFS 平均等待4.333（模型） |
| threads | 17 | results=20,40 |
| mutex | 18 | counter=20000 |
| queue | 19 | sum=15 |
| paging | 22 | page=3 offset=1 physical=5（模型） |
| replacement | 23 | FIFO faults=5（模型） |
| mapping | 24 | mapping=X file=a |
| listdir | 27 | 列出给定目录的普通命名项 |
| socket-demo | 32 | local socket bytes，本机AF_UNIX |
| mini-shell | 35 | 命令、目录、单管道与末尾输出重定向 |

模型中的时间单位、页大小与引用序列是固定教学输入，不会修改操作系统调度或真实页表。其他章节使用纸上演算、终端观察或复用已有例程，并非每章都新增一个程序。

## 单独编译

详细版第二批已把functions.c调整为仅使用整数参数的add_minutes，输出仍为sum=90。数组参数的sum_values移到第07章正文教学例子，避免第06章依赖尚未解释的数组。正文中的其他完整变体和综合练习通过教材提取脚本验证，未全部计入这里的23个主线文件。

第六批为mapping.c补上fileno返回检查和fflush交接，原正常输出保持不变；全部23个主线已再次回归。更多翻译、置换、映射变体与模拟器见 [第六批练习](../详写第六批-练习与参考答案.md)，它们不重复计为本目录新增主线文件。

```bash
gcc -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -g process.c -o process
gcc -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -g -pthread mutex.c -o mutex
```

`-D_POSIX_C_SOURCE=200809L` 选择本课需要的 POSIX 声明；`-pthread` 用于线程程序。文件名更换为需要的例程即可。省略 lab.h 会导致包含失败，不应把它当作需要联网下载的第三方包。

## 公共辅助头文件 lab.h

die 立即报告 errno 并结束实验进程；thread_check 处理线程接口直接返回的错误码；write_all 循环完成阻塞写入并处理 EINTR；wait_child 循环等待指定子进程并解码退出结果。它们的“失败即结束”策略面向教学小程序，复杂长期服务需自行设计恢复和清理协议。

[完整源码：lab.h](lab.h)

```c
#ifndef OS_LAB_H
#define OS_LAB_H
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static inline void die(const char *name) {
    perror(name);
    exit(EXIT_FAILURE);
}

static inline void thread_check(int code, const char *name) {
    if (code != 0) {
        fprintf(stderr, "%s: %s\n", name, strerror(code));
        exit(EXIT_FAILURE);
    }
}

static inline void write_all(int fd, const void *data, size_t length) {
    const unsigned char *p = data;
    while (length > 0) {
        ssize_t n = write(fd, p, length);
        if (n < 0 && errno == EINTR) { continue; }
        if (n < 0) { die("write"); }
        if (n == 0) { fputs("write: no progress\n", stderr); exit(EXIT_FAILURE); }
        p += n;
        length -= (size_t)n;
    }
}

static inline int wait_child(pid_t pid) {
    int status;
    while (waitpid(pid, &status, 0) < 0) {
        if (errno != EINTR) { die("waitpid"); }
    }
    if (WIFEXITED(status)) { return WEXITSTATUS(status); }
    if (WIFSIGNALED(status)) { return 128 + WTERMSIG(status); }
    return 1;
}
#endif
```

## 交互与自动检查

signal-demo 运行后按 Ctrl+C 结束；mini-shell 输入 exit 结束，支持范围见第 35 章。只在自己的实验目录使用 `>`，它会覆盖指定文件。

有 Python3 时，从本目录运行 `python3 ../验证/verify.py`，检查脚本在临时目录编译，测试正常/失败输入、重复并发、信号与 Shell。结果写到课程自己的验证目录。Python 只是附带验收工具，不是本课程另一个语言先修。

第九批修正mini-shell的整行字节边界、NUL拒绝、输入无缓冲交接、执行失败126/127区分、输出刷新和第二次fork失败时终止回收直接child。输入限1023非换行字节，每侧最多63个token。全部23例程已于2026-11-12重新回归133项；教学变体与help改造见 [第九批练习](../详写第九批-练习与参考答案.md)。

可选 [Shell追加输出实践](../进阶实践01-Shell追加输出从零实现.md)的append-fds.c与mini-shell-append.c位于相邻的进阶代码目录，不计作本目录第24、25个主线例程。学习时把所需C文件与本目录lab.h复制到自己的新练习目录，再按实践页编译。
