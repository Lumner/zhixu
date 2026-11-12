# 29 设备、中断、DMA与存储：一次I/O怎样真正前进

> **零基础详细版 · 已重写。** 把驱动、通知、传输与等待连成路径，运行就绪接口和有限磁盘调度模型，明确它们与真实设备性能的边界。建议7—10小时。

## 1. 从文件接口往下看

前面read/write面向描述符，文件系统解释名字和对象，缓存可能暂存内容。若需要真正向设备取得或送出数据，接下来由谁安排？

本章学完应能画出I/O路径，区分中断、轮询、系统调用、阻塞和异步；解释DMA仍需要CPU与驱动管理；手算机械寻道模型而不套到SSD。先修为第11、14、16、28章。

## 2. 驱动负责连接软件与设备

**设备驱动**是与特定设备类别或接口交互的软件，负责配置请求、访问规定寄存器、管理队列和处理完成等。应用通常使用操作系统接口，不直接把用户指针塞进设备寄存器。

同样的read，目标可以是普通文件、管道、终端或设备，对应实现不一样。普通文件缓存命中时，可能根本没有一次新的设备读取，不能从应用调用次数推断中断或磁盘操作次数。

## 3. 一条简化路径

```text
应用提出请求 → 内核检查与缓存/文件处理 → 驱动组织请求
→ 设备与内存传输 → 完成通知或状态检查 → 内核更新并唤醒/报告
```

不是每次请求都严格逐个走完六步。设备可以并行、合并请求或批量通知；缓存也可能提前满足。本图提供责任位置，不是某款CPU或存储控制器的逐指令追踪。

## 4. 轮询与中断分别怎样通知

**轮询**是软件主动检查某个状态是否变化；若不停检查又不让出执行机会，可能浪费CPU。**中断**是硬件等事件通知处理器的一种机制，使系统有机会处理完成或其他事件。

中断可能合并、延后或批量处理，不保证每次传输恰好一个中断。负载和设备特性不同，混合轮询与中断也可能有意义；不能简单给其中一个贴“永远更快”的标签。

## 5. 系统调用、异常和中断别混用

系统调用是应用主动请求受控内核服务；页故障等异常与当前指令执行条件有关；设备中断通常来自异步外部事件。具体入口机制依体系结构不同。

“进入内核”不等于“设备产生中断”，也不表示必然切换进程。read可能立即在缓存中完成，也可能使调用线程等待，第12和16章的状态模型仍适用。

## 6. DMA究竟节省什么

**直接内存访问DMA**允许设备按受控配置在设备与内存之间传输数据，减少CPU逐字节搬运。CPU仍需准备缓冲与描述信息，驱动提交请求并处理完成。

所以DMA不是CPU完全不参与，也不是任意设备可随便读写整个进程地址空间。传输期间谁拥有缓冲、何时能重用、缓存一致性与顺序怎样保证，都是协议的一部分。

## 7. 设备看到的地址不一定等于用户指针

第21章区分虚拟地址与CPU物理地址；设备还可能使用DMA/总线地址。IOMMU是一类为设备访问提供地址映射与限制的机制，具体系统是否采用及怎样配置取决于平台。

驱动需要使用对应DMA接口建立映射与同步，不能把malloc得到的普通用户指针直接当作设备可用地址。本课不写内核驱动、不操作真实DMA寄存器，也不读取物理地址来冒充完成实验。

## 8. 缓冲所有权的概念表

| 阶段 | 谁可以按协议使用 | 不应做什么 |
| --- | --- | --- |
| CPU准备 | 应用/驱动填充相应数据 | 未提交就宣称设备已完成 |
| 设备处理 | 设备按配置读写缓冲 | 未确认结束就free或无规则重写 |
| 完成与同步 | 驱动确认并完成必要同步 | 仅看提交成功就读取未就绪结果 |
| CPU继续 | 上层按完成协议消费结果 | 重复回收或重用仍被引用对象 |

这是概念协议，不是可以复制进用户态的DMA代码。它与线程参数生命期、队列任务所有权有相通之处，但设备与CPU的同步规则需要专门接口。

## 9. 阻塞、非阻塞与异步的区别

**阻塞调用**在条件暂不满足时可以等待，线程通常不需要持续占用CPU计算。**非阻塞**让某些暂不可满足操作返回EAGAIN等结果，由调用者安排后续。**异步I/O**把提交与完成报告分离。

非阻塞不等于设备瞬间完成，异步提交成功也不等于结果已经有效。立即返回一个句柄，只是把等待责任换了组织方式；要能指出下一步从哪里得到完成结果。

## 10. 就绪通知与忙等不是一回事

POSIX poll是等待描述符就绪的接口，可以在内核等待而不做用户态忙循环。它的名字与“软件反复轮询寄存器”相近，但不能据此认为poll调用本身一定忙等。

就绪不直接消费数据，也不保证其他线程不会先消费；真实多参与者仍需处理再次读取的返回值。普通文件上的poll就绪也不代表底层所有存储I/O早已完成。本节用单读者管道隔离这个问题。

## 11. 完整就绪与EOF实验

Linux/WSL Ubuntu的Bash，目录`~/os-lab/files`，lab.h同目录。

**完整程序：io-ready.c**

```c
#include "lab.h"
#include <fcntl.h>
#include <poll.h>

int main(void) {
    int fd[2];
    if (pipe(fd) < 0) { die("pipe"); }
    int failed = 1;
    int flags = fcntl(fd[0], F_GETFL);
    if (flags < 0 || fcntl(fd[0], F_SETFL, flags | O_NONBLOCK) < 0) {
        perror("fcntl"); goto cleanup;
    }
    char byte;
    ssize_t n = read(fd[0], &byte, 1);
    if (n != -1 || (errno != EAGAIN && errno != EWOULDBLOCK)) {
        fputs("expected temporarily empty pipe\n", stderr); goto cleanup;
    }
    puts("empty=would_block");
    do { n = write(fd[1], "K", 1); } while (n < 0 && errno == EINTR);
    if (n < 0) { perror("write"); goto cleanup; }
    if (n != 1) { fputs("short pipe write\n", stderr); goto cleanup; }
    int close_result = close(fd[1]);
    fd[1] = -1;
    if (close_result < 0) { perror("close writer"); goto cleanup; }
    struct pollfd event = {fd[0], POLLIN, 0};
    int ready;
    do { ready = poll(&event, 1, -1); } while (ready < 0 && errno == EINTR);
    if (ready < 0) { perror("poll"); goto cleanup; }
    if (!(event.revents & POLLIN)) { fputs("expected readable data\n", stderr); goto cleanup; }
    do { n = read(fd[0], &byte, 1); } while (n < 0 && errno == EINTR);
    if (n != 1) { fputs("expected queued byte\n", stderr); goto cleanup; }
    printf("ready_read=%c\n", byte);
    if (read(fd[0], &byte, 1) != 0) { fputs("expected EOF after drain\n", stderr); goto cleanup; }
    puts("after_drain=EOF");
    failed = 0;
cleanup:
    for (int i = 0; i < 2; i++) {
        if (fd[i] >= 0 && close(fd[i]) < 0) { perror("close pipe"); failed = 1; }
    }
    return failed;
}
```

按前章编译选项生成io-ready，预期三行empty=would_block、ready_read=K、after_drain=EOF。写入发生在poll以前，单个读者没有抢读，所以无需sleep或另一个线程安排时机。

## 12. 为什么关闭写端以后还要读K

写端已经关闭并不抹去排队字节。poll可以同时报告POLLIN与POLLHUP；先把现有K读走，缓冲读空以后才得到EOF。仅看到HUP就丢弃可读数据，会丢尾部内容。

本程序明确检查POLLIN并再次read结果。poll返回值描述就绪项数量或失败，event.revents包含事件位；`&`是按位检查，不是把全部整数当作一个事件名称。

## 13. 机械磁盘时间包含哪些部分

机械硬盘的一次请求常需要定位磁头、等目标扇区转到位置、传输数据，还可能经过队列与控制开销。磁头移动距离模型只覆盖其中一个因素。

假设寻道5ms、平均旋转等待4.167ms、传4096字节且速率100000000字节/秒，传输约0.04096ms，总计约9.20796ms，忽略其余开销。这里参数是演算假设，不是你的机器实测。

7200转/分钟的每转时间为60/7200秒≈8.333ms，平均半转约4.167ms。单位换算先做清楚，别把每分钟转速直接当每秒。

## 14. 三种调度先固定同一输入

磁道0—199，初始50，请求90、10、20都已到达；只算移动距离，完成全部请求时停止，不算旋转和传输。

FCFS按给定顺序：50→90→10→20，40+80+10=130。SSTF每次取最近未完成：50→20→10→90，30+10+80=120。LOOK初始向大编号：50→90→20→10，40+70+10=120。

同时到达时平局也需要规则。本程序SSTF距离相同时保留输入顺序优先，不能靠模糊“随便选”要求唯一输出。

## 15. 完整有限调度模型

**完整程序：disk-schedule.c**

```c
#include <stdio.h>

static int distance(int a, int b) { return a > b ? a - b : b - a; }
static void fcfs(const int requests[3]) {
    int current = 50, total = 0;
    printf("FCFS path=50");
    for (int i = 0; i < 3; i++) {
        total += distance(current, requests[i]);
        current = requests[i];
        printf("->%d", current);
    }
    printf(" distance=%d\n", total);
}
static void sstf(const int requests[3]) {
    int used[3] = {0, 0, 0};
    int current = 50, total = 0;
    printf("SSTF path=50");
    for (int step = 0; step < 3; step++) {
        int chosen = -1;
        for (int i = 0; i < 3; i++) {
            if (!used[i] && (chosen < 0 || distance(current, requests[i]) < distance(current, requests[chosen]))) {
                chosen = i;
            }
        }
        total += distance(current, requests[chosen]);
        current = requests[chosen];
        used[chosen] = 1;
        printf("->%d", current);
    }
    printf(" distance=%d\n", total);
}
static void look(const int requests[3]) {
    int sorted[3] = {requests[0], requests[1], requests[2]};
    for (int i = 0; i < 3; i++) {
        for (int j = i + 1; j < 3; j++) {
            if (sorted[j] < sorted[i]) { int temp = sorted[i]; sorted[i] = sorted[j]; sorted[j] = temp; }
        }
    }
    int current = 50, total = 0;
    printf("LOOK path=50");
    for (int i = 0; i < 3; i++) {
        if (sorted[i] >= 50) { total += distance(current, sorted[i]); current = sorted[i]; printf("->%d", current); }
    }
    for (int i = 2; i >= 0; i--) {
        if (sorted[i] < 50) { total += distance(current, sorted[i]); current = sorted[i]; printf("->%d", current); }
    }
    printf(" distance=%d\n", total);
}
int main(void) {
    const int requests[3] = {90, 10, 20};
    fcfs(requests);
    sstf(requests);
    look(requests);
    return 0;
}
```

编译为disk-schedule，输出应匹配第14节三条路径与130/120/120。固定数字范围小，distance减法不会溢出；扩展任意外部整数前必须重新验证范围。

## 16. SCAN与LOOK怎样区分

SCAN通常按声明方向扫向边界后回头；LOOK到当前该方向最远请求就回头。本例低端仍有请求，若SCAN先到199，再返回服务20和10，距离为149+179+10=338。

若只服务到最后一个请求就停止，是否还有额外移动必须写明；不能一边算LOOK一边偷偷加入到边界的路程。动态到达时，还要按时刻更新候选请求，不能把所有未来请求预先当作已排队。

SSTF可能让持续被近请求挤后的远请求饥饿，低平均移动距离不是唯一设计目标。

## 17. SSD为什么不能套磁头模型

SSD没有机械磁头寻道，但仍有内部并行、队列、页编程与块擦除、映射和回收等约束。逻辑块地址相邻与真实物理布局也未必相同。

所以把90→10算成80，再据此预测NVMe延迟没有对应物理意义。实际性能还受请求大小、读写混合、队列深度、缓存、设备状态等影响，本课不把这份模型当基准工具。

## 18. 延迟与吞吐的单位练习

延迟描述一个请求耗时；吞吐描述单位时间完成多少工作；IOPS是每秒I/O次数。小请求高IOPS与大请求高字节吞吐不是同一指标。

假设最多8个独立在途请求、平均每个100微秒且无其他瓶颈，按这个简化上限估算8/0.0001=80000 IOPS。每个4KiB，则327680000字节/秒≈312.5MiB/s。它只是条件推算，不能当真实SSD保证或产品规格。

## 19. 常见错误、练习与参考答案

1. read调用7次是否必然7次设备中断？不必，缓存、合并与实现不同。
2. DMA是否允许马上free仍被设备使用的缓冲？不允许，必须遵守完成与所有权协议。
3. 非阻塞返回EAGAIN是否等于EOF？不是，暂不可用与输入结束不同。
4. 原请求改为10、20、90，FCFS多少？40+10+70=120；顺序不同让结果改变。
5. 本例LOOK和SSTF都120，能说策略等价吗？不能，选人规则不同，在别的输入和到达情况下可能分化。
6. poll的HUP与IN能否同时出现？管道尾部仍有数据时可以，先按返回值读完。

动手题：仅修改disk-schedule的requests为10、20、90，先手算三个路径，再编译核对。不要对真实设备队列或驱动参数作修改。

## 20. 完成条件与资料

能画请求路径、区分通知与传输，运行就绪/EOF实验，正确计算三种固定模型并说明单位与边界。随后完成[本批综合练习和保存项目](详写第七批-练习与参考答案.md)。

原理参考作者教材[OSTEP I/O Devices](https://pages.cs.wisc.edu/~remzi/OSTEP/file-devices.pdf)，DMA地址与责任依据[Linux内核DMA指南](https://docs.kernel.org/core-api/dma-api-howto.html)，就绪语义见[poll(2)](https://man7.org/linux/man-pages/man2/poll.2.html)。核验2026-11-05。本章没有控制真实DMA、测存储硬件或修改内核调度。
