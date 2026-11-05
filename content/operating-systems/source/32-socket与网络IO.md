# 32 socket 与网络 I/O

> **旧版简稿 · 待详细重写。** 本章暂未达到零基础详细版标准。请优先学习已重写的01—16章，进度和后续批次见 [详细版学习指南](详细版学习指南与改写进度.md)。

## 32.1 socket 是通信端点

先懂描述符、管道和阻塞。socket 给进程提供通信端点，在 Linux 中也通过 fd 参与 read/write 等操作，但连接、地址与协议需要额外接口。AF_UNIX 常用于同一主机，AF_INET 常用于 IPv4；SOCK_STREAM 表示字节流语义的一类接口。

TCP 连接由通信地址、端口与协议等标识，端口不是进程 PID。服务器通常 socket→bind→listen→accept，客户端 socket→connect；accept 返回新的已连接 fd，监听 fd 继续接收连接。只创建 socket 不等于已经能对外服务。

## 32.2 完整本机实验 socket-demo.c

[完整源码：socket-demo.c](示例代码/socket-demo.c)

```c
#include "lab.h"
#include <sys/socket.h>

int main(void) {
    int fd[2];
    if (socketpair(AF_UNIX, SOCK_STREAM, 0, fd) < 0) { die("socketpair"); }
    const char text[] = "local socket bytes\n";
    write_all(fd[0], text, sizeof text - 1);
    if (shutdown(fd[0], SHUT_WR) < 0) { die("shutdown"); }
    char buffer[8];
    for (;;) {
        ssize_t n = read(fd[1], buffer, sizeof buffer);
        if (n < 0 && errno == EINTR) { continue; }
        if (n < 0) { die("read"); }
        if (n == 0) { break; }
        write_all(STDOUT_FILENO, buffer, (size_t)n);
    }
    close(fd[0]);
    close(fd[1]);
    return 0;
}
```

运行 `make socket-demo`、`./socket-demo`，输出 `local socket bytes`。socketpair 直接建立一对 AF_UNIX 本机端点，不访问外网、不监听 TCP 端口，也没有通过这个例程验证真实互联网连接。

写入端发送少量固定字节，再 shutdown(SHUT_WR) 关闭发送方向，另一端循环读直到 0。缓冲区每次只有 8 字节，必须按实际长度处理。主例程同一进程先写后读只适用于这个很小的固定载荷；扩展到任意大数据，应并发读写或用就绪机制避免写满后双方不能推进。

## 32.3 字节流不保留消息边界

发送一次 20 字节，对方可能分成 8+8+4，也可能以别的长度读到。两次 send 也可能被一次接收。TCP 保障有序可靠字节流，不自动告诉应用“这条 JSON 到这里结束”。应用协议可使用长度前缀、分隔符或固定格式，必须考虑最大长度、截断和非法输入。

read 返回 0 通常表示对端发送方向结束；返回 -1 要看 errno；非阻塞 EAGAIN 表示暂时没有可读数据，不是永久 EOF。send/write 也可能短写，不能只检查“没有返回 -1”。

## 32.4 并发服务与就绪通知

一个连接一个线程，结构直观但有资源成本；select/poll/epoll 等机制让一个执行流等待多个 fd 就绪，再推进各连接状态。就绪表示某类操作可能推进，不等于完整消息已经到齐。异步完成机制又是另一种接口风格。

第 19 章的谓词思维仍适用：当前连接有多少缓冲、下一步需要多少数据、什么时候结束、失败后谁关闭 fd。网络库可以隐藏部分细节，却不能替你定义消息协议。

## 32.5 练习、答案与完成条件

①socketpair 成功能证明防火墙允许 TCP 入站吗？②读到 8 字节就是完整消息吗？③监听 fd 与 accept 返回 fd 是否职责相同？答案：①不能；②取决于应用协议，不能仅凭 read 次数；③前者接新连接，后者处理某个连接。

完成条件：画出一个 TCP 服务的接口顺序，指出协议边界、短读写和 EOF；同时准确描述本机实验实际验证的范围。
