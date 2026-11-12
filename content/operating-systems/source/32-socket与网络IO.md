# 32 socket 与网络 I/O

> **零基础详细版 · 已重写。** 先修：描述符、管道、EOF、短读写与第29章的就绪概念。建议10—14小时，拆成字节流、协议解析、TCP流程三次学习。

## 32.1 学习目标：不要按read次数猜消息

本章从“两个程序怎样交换数据”开始，不预设你学过网络课程。学完应能区分socket端点、地址、端口和协议；解释监听fd与连接fd；用实际字节数重组数据；识别正常结束、截断、超长输入和系统错误。

实验分三层：原有AF_UNIX成对端点、独立的长度前缀解析器、仅本机回环的TCP往返。前一个成功不能代替后一个，更不能据此宣布公网、DNS或防火墙已经验证。先在纸上写清每层想证明什么。

## 32.2 通信端点像电话哪一部分

**socket**是进程使用的通信端点。它可以由fd引用，因此常能参与`read/write`等操作，但创建、连接和地址管理需要额外接口。把它比作电话的一端有助于理解“两边协作”，却不要把一个socket等同于一整段互联网。

**协议**是通信双方遵守的规则，既可以指TCP等传输规则，也可以指应用自己规定的消息格式。TCP帮助传送有序字节，不知道这些字节代表聊天文本、图片还是一条命令。应用仍需约定长度、格式、错误与结束条件。

## 32.3 地址、端口与PID各表示什么

IP地址用于网络层面的地址识别与路由相关工作；**端口**是传输层端点标识的一部分，不能与进程PID混用。一个进程可以管理多个socket；连接也不是只靠一个端口数字就能完整标识，通常还要结合协议及两端地址、端口。

`127.0.0.1`是IPv4回环地址，本章用它把通信限制在当前网络环境的本机回环路径。容器里的“本机”还涉及网络命名空间，下一章会说明。端口0用于本例`bind`时请求系统分配可用端口，不意味着连接目标永远填写0。

## 32.4 AF_UNIX、AF_INET与SOCK_STREAM

`socket`的地址族说明端点使用哪类地址机制：`AF_UNIX`常用于同一Linux环境的本地进程通信；`AF_INET`用于IPv4。`SOCK_STREAM`指定流式语义的一类端点；对`AF_INET`配合这里的默认协议，得到TCP。

`socketpair(AF_UNIX, SOCK_STREAM, 0, fd)`直接创建两个已连接的本地端点，无需先绑定IP地址或监听端口。它们与管道一样需要处理部分读写，又提供双向流式通信等能力。地址族、端点类型和应用消息格式是三个不同维度。

## 32.5 原有完整例程：先观察发送方向结束

把下载包`示例代码`里的`socket-demo.c`与`lab.h`放在同一练习目录，或直接在下载包该目录编译。以下代码与原文件一致。

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

在**Ubuntu/WSL的Bash，包含这两个文件的目录**执行：

```bash
gcc -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -Werror socket-demo.c -o socket-demo
./socket-demo
```

应输出`local socket bytes`和换行。公共`write_all`处理短写与EINTR，解释见第11章。这个小主例程结束时没有把`close`错误提升为退出失败；后面的详细程序采用显式收尾。不要把它推广成任意规模、完整容错的网络库。

## 32.6 shutdown与close各做什么

`shutdown(fd[0], SHUT_WR)`关闭该连接端点的发送方向：先前发送的字节仍可由另一端读取；读完后，另一端的流读取可得到0。端点的接收方向仍可用于接收回复，这种只结束一个方向的行为称为**半关闭**。

`close`释放当前进程拥有的一个描述符引用，不等同于只关闭发送方向；如果还有复制的引用，连接资源的生命周期也要结合它们理解。删除本例的`shutdown`但又不关闭发送端，接收端读完已有字节后可能继续等待，因为尚未观察到发送方向结束。

## 32.7 字节流不保留应用消息边界

假设发送字节为`ABCDE`，再发送`FG`。接收端可能分成`AB`、`CDEF`、`G`，也可能一次拿到全部七字节。不能根据发送调用次数、TCP包数量或某次接收长度，直接断定应用消息在哪结束。

本例缓冲区8字节，因此一次最多得到8字节；实际可能更少。`read`返回正数表示本次得到的实际数量，返回0对这里的非零长度流读取表示发送方向结束，返回-1则按errno区分中断、暂不可用和真正错误。非阻塞`EAGAIN`不是EOF。

## 32.8 先自己定义一个小协议

本章的**教学应用协议**是：两字节无符号长度，高位在前，随后恰好N字节内容，N范围0—64；每次会话只允许一帧，帧后必须结束输入。这里“帧”只是应用记录，不是以太网帧。

```text
00 03  41 00 42
长度3   A NUL B
```

高位在前的计算是`N = 第一个字节 × 256 + 第二个字节`。这份约定用固定的字节计算避免两台机器本机整数布局不同。内容允许NUL，不能用`strlen`确定收到的负载长度。最大长度是协议规则，必须在接收负载前检查。

## 32.9 状态表比“读一次”更可靠

| 当前状态 | 需要什么 | 遇到输入结束怎么办 |
| --- | --- | --- |
| 读取头部 | 累积2字节 | 0字节是缺失帧，1字节是截断头 |
| 检查长度 | 计算N并比较64 | 超限立即拒绝 |
| 读取内容 | 累积N字节 | 未够N就是截断内容 |
| 检查结尾 | 再读取1字节，应得到EOF | 多余字节属于协议错误 |
| 生成输出 | 输出长度与十六进制内容 | 输出失败属于I/O错误 |

空负载N=0合法，但“整个输入0字节”不合法，因为连头部都没提供。对于长期连接，不能要求每帧后EOF，需要改成循环解析多帧；那是另一份协议，本例故意只处理一帧。

## 32.10 完整程序：从标准输入解析一帧

保存为`frame-read.c`。它通过标准输入接收字节，因此可先用管道独立测试解析逻辑，第八批综合练习再把它接到socket。程序每次读取故意最多3字节，练习累积处理，不假定内核天然按3字节分包。

**完整程序：frame-read.c**

```c
#include <errno.h>
#include <stdio.h>
#include <unistd.h>

static int exact(unsigned char *data, size_t need) {
    size_t used = 0;
    while (used < need) {
        size_t step = need - used;
        if (step > 3) { step = 3; }
        ssize_t n = read(STDIN_FILENO, data + used, step);
        if (n < 0 && errno == EINTR) { continue; }
        if (n < 0) { perror("read"); return 1; }
        if (n == 0) { fputs("truncated frame\n", stderr); return 2; }
        used += (size_t)n;
    }
    return 0;
}

int main(void) {
    unsigned char header[2], body[64], extra;
    int status = exact(header, sizeof header);
    if (status != 0) { return status; }
    size_t length = (size_t)header[0] * 256 + header[1];
    if (length > sizeof body) {
        fputs("length exceeds 64\n", stderr);
        return 2;
    }
    status = exact(body, length);
    if (status != 0) { return status; }
    ssize_t tail;
    do { tail = read(STDIN_FILENO, &extra, 1); }
    while (tail < 0 && errno == EINTR);
    if (tail < 0) { perror("read tail"); return 1; }
    if (tail != 0) { fputs("trailing bytes\n", stderr); return 2; }
    int failed = printf("bytes=%zu\nhex=", length) < 0;
    for (size_t i = 0; i < length; ++i) {
        if (printf("%02x", (unsigned int)body[i]) < 0) { failed = 1; }
    }
    if (putchar('\n') == EOF || fflush(stdout) == EOF) { failed = 1; }
    return failed;
}
```

## 32.11 读懂累积、返回值与空内容

`used`记录已经获得多少字节；`data + used`让下一次读取接在已有内容后面；`need - used`防止超过目标。只有成功返回正数才增加`used`。`EINTR`重试，其他读取错误返回1，输入不符合协议返回2。

当length为0时，`exact(body, 0)`不进入循环，空负载自然合法。头部从`unsigned char`计算，避免有符号字符把高位字节解释成负数。程序在完整验证结尾之前没有输出正常结果，因此截断和尾随输入不会先得到看似成功的响应。

## 32.12 编译并手工构造字节输入

在**Ubuntu/WSL的Bash，`~/os-lab/batch08`目录**保存代码，执行：

```bash
gcc -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -Werror frame-read.c -o frame-read
printf '\000\003A\000B' | ./frame-read
echo $?
printf '\000\000' | ./frame-read
printf '\000\003AB' | ./frame-read
echo $?
printf '\000\000X' | ./frame-read
echo $?
```

Bash的`printf`在这些格式串中生成八进制转义指定的字节。第一组输出`bytes=3`与`hex=410042`，状态0；第二组空负载成功；第三组少一个内容字节，状态2；第四组存在尾随字节，状态2。不要用`echo`代替精确字节构造，它常会额外添加换行。

## 32.13 TCP服务的接口顺序

```text
服务端：socket → bind → listen → accept → 已连接fd读写 → close
客户端：socket → connect → 已连接fd读写 → close
```

`bind`把端点与本地地址关联，`listen`让它接收连接请求，`accept`取出一个连接并返回新的fd。监听fd负责后续连接，已连接fd负责本次通信。客户端`connect`成功也不表示应用请求已经处理完，更不表示服务的业务规则正确。

下面在同一进程中持有客户端和服务端端点，利用已监听的队列先完成本机连接再accept。这样先专注接口顺序；真实服务器往往由独立客户端连接，并需要并发、截止时间和资源上限设计。

## 32.14 完整程序：仅回环的固定四字节往返

保存为`tcp-loop.c`，平台Linux。它绑定`127.0.0.1`和系统分配端口，只做一组`ping/pong`，这是一份**固定四字节协议**，不复用前面的长度帧。发送与接收超时设为2秒，错误立即收尾；不是通用服务程序。

**完整程序：tcp-loop.c**

```c
#include <errno.h>
#include <netinet/in.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

static int timeouts(int fd) {
    struct timeval value = { .tv_sec = 2, .tv_usec = 0 };
    if (setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &value, sizeof value) < 0 ||
        setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &value, sizeof value) < 0) {
        perror("setsockopt"); return -1;
    }
    return 0;
}

static int transfer(int fd, unsigned char *data, size_t size, int sending) {
    size_t used = 0;
    while (used < size) {
        size_t step = size - used;
        if (!sending && step > 2) { step = 2; }
        ssize_t n = sending ? send(fd, data + used, step, MSG_NOSIGNAL)
                            : recv(fd, data + used, step, 0);
        if (n < 0 && errno == EINTR) { continue; }
        if (n < 0) { perror(sending ? "send" : "recv"); return -1; }
        if (n == 0) { fputs("unexpected end or no progress\n", stderr); return -1; }
        used += (size_t)n;
    }
    return 0;
}

int main(void) {
    int listener = -1, client = -1, peer = -1, result = 1;
    struct sockaddr_in address = {0};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    address.sin_port = htons(0);
    listener = socket(AF_INET, SOCK_STREAM, 0);
    if (listener < 0) { perror("socket listener"); goto done; }
    if (bind(listener, (struct sockaddr *)&address, sizeof address) < 0) {
        perror("bind"); goto done;
    }
    if (listen(listener, 1) < 0) { perror("listen"); goto done; }
    socklen_t length = sizeof address;
    if (getsockname(listener, (struct sockaddr *)&address, &length) < 0) {
        perror("getsockname"); goto done;
    }
    if (length != sizeof address || address.sin_port == 0) {
        fputs("unexpected bound address\n", stderr); goto done;
    }
    client = socket(AF_INET, SOCK_STREAM, 0);
    if (client < 0) { perror("socket client"); goto done; }
    if (timeouts(client) < 0) { goto done; }
    if (connect(client, (struct sockaddr *)&address, sizeof address) < 0) {
        perror("connect"); goto done;
    }
    do { peer = accept(listener, NULL, NULL); }
    while (peer < 0 && errno == EINTR);
    if (peer < 0) { perror("accept"); goto done; }
    if (timeouts(peer) < 0) { goto done; }
    unsigned char request[4] = {'p','i','n','g'}, answer[4] = {'p','o','n','g'};
    unsigned char received[4];
    if (transfer(client, request, 4, 1) < 0 || transfer(peer, received, 4, 0) < 0) { goto done; }
    if (memcmp(received, request, 4) != 0) { goto done; }
    if (transfer(peer, answer, 4, 1) < 0 || transfer(client, received, 4, 0) < 0) { goto done; }
    if (memcmp(received, answer, 4) != 0) { goto done; }
    result = 0;
    if (puts("connected=loopback\nrequest=ping\nreply=pong") == EOF || fflush(stdout) == EOF) {
        result = 1;
    }
done:
    if (peer >= 0 && close(peer) < 0) { result = 1; }
    if (client >= 0 && close(client) < 0) { result = 1; }
    if (listener >= 0 && close(listener) < 0) { result = 1; }
    return result;
}
```

## 32.15 新结构体、字节序与短收发

`struct sockaddr_in`存放IPv4地址族、端口等信息。`{0}`先把成员清零，再逐项赋值；`htonl/htons`把主机整数转换为接口要求的网络字节序。`(struct sockaddr *)&address`是这个通用地址接口要求的指针转换，不代表可以随意把无关对象强转使用。

`getsockname`把实际分配的端口写回结构体，客户端随后使用这个端口。`socklen_t length`进入函数前是缓冲区容量，返回后是实际地址长度。`transfer`发送时用`MSG_NOSIGNAL`避免对端已关闭时直接被SIGPIPE终止，仍需处理错误返回；这是这里采用的Linux发送方式。

接收每次最多2字节，仍要累计至4字节才比较。`memcmp`按明确长度比较二进制，不要求NUL终止。发送或接收返回0不增加进度，程序直接失败，避免无限循环。

## 32.16 运行与本机通信范围

在**Ubuntu/WSL的Bash，`~/os-lab/batch08`目录**执行：

```bash
gcc -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -Werror tcp-loop.c -o tcp-loop
./tcp-loop
echo $?
```

正常输出三行`connected=loopback`、`request=ping`、`reply=pong`，状态0。端口没有硬编码，也不需要管理员权限。若环境策略禁止socket或回环连接，保留错误，不修改防火墙或扩大绑定地址。

这里验证了当前环境IPv4/TCP回环建立连接与小消息往返，没有经过外部DNS、路由器或公网。单次I/O超时不是整个会话的统一截止时间，连接与系统调用还可能受环境影响；自动验证另有进程组级超时，教学程序没有声称能应付恶意慢连接。

## 32.17 从一个连接走向多个连接

一个连接一个线程较容易开始，但线程数量、栈、fd和缓冲都有限。`poll/epoll`可以等待多个fd就绪，再按每个连接的状态推进。**就绪**意味着某类操作可以尝试推进，不表示完整头部或整帧内容已经到齐。

为每个连接至少记录：头部已读多少、声明长度、内容已读多少、响应已发多少、是否结束、谁负责关闭。第19章的谓词思维依然适用：别只问“收到通知了吗”，要问“目前状态是否满足下一步条件”。本批不实现多客户生产服务。

## 32.18 常见错误与排查表

| 错误 | 可能结果 | 修正思路 |
| --- | --- | --- |
| 用一次read接收整条请求 | 得到半个头或半个负载 | 依据协议状态累积 |
| 对二进制负载用strlen | NUL后内容被忽略 | 使用协议给出的长度 |
| 声明任意长度就分配 | 资源消耗失控 | 先检查上限再接收 |
| 读完内容还等EOF，发送端不半关闭 | 双方等待 | 明确单帧会话结束协议 |
| 在监听fd上读请求 | 操作对象不对 | 使用accept返回的连接fd |
| 把EAGAIN视作永久结束 | 丢失后续数据 | 按阻塞方式与超时规则处理 |

同进程先发后收只适合本例固定很小的数据。把负载无限增大会写满发送缓冲，导致自己无法进入后续接收阶段。第八批综合项目会让父子两个进程协作，也仍保留容量上限。

## 32.19 练习与参考答案

**A：** `00 04 41 42`随后EOF是什么？**参考答案：** 长度4却只有2字节负载，截断，状态2。

**B：** `01 00`应该先申请256字节再判断吗？**参考答案：** 不应。本协议最大64，读头计算出256后立即拒绝，不继续等待内容。

**C：** 一次send成功返回3，而需要发送5字节，接下来怎么做？**参考答案：** 从原缓冲区偏移3的位置继续发送剩余2字节；检查中断、错误与无进展，不能把原5字节全部重发。

**D：** AF_UNIX测试和本机TCP都成功，就能推出浏览器HTTPS正常吗？**参考答案：** 不能。它们没有验证域名解析、公网路径、TLS证书或HTTP应用行为。

**E：** 两个连续合法帧交给本解析器会怎样？**参考答案：** 第一帧之后发现额外字节，按本章单帧约定拒绝；多帧连接必须设计另一套循环状态。

## 32.20 完成条件与官方资料

能画出监听fd与连接fd的区别；手算至少六组长度帧并解释状态；独立编译三份例程，复现正常、空负载、截断与尾随输入；说明半关闭、短读写及回环范围。完成后做第八批综合练习，把解析器接到父子socket通道。

资料核验日期：**2026-11-10**。接口语义见[socket(2)](https://man7.org/linux/man-pages/man2/socket.2.html)、[socketpair(2)](https://man7.org/linux/man-pages/man2/socketpair.2.html)、[shutdown(2)](https://man7.org/linux/man-pages/man2/shutdown.2.html)、[recv(2)](https://man7.org/linux/man-pages/man2/recv.2.html)、[tcp(7)](https://man7.org/linux/man-pages/man7/tcp.7.html)及[getsockname(2)](https://man7.org/linux/man-pages/man2/getsockname.2.html)。消息格式与练习程序为本课自行设计。
