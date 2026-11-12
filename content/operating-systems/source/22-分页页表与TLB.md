# 22 分页、页表与TLB：一步一步把地址翻译出来

> **零基础详细版 · 已重写。** 从除法和余数开始，手算地址、检查页表状态，再理解多级结构与翻译缓存。所有C页表都是有限教学模型。建议8—11小时。

## 1. 本章目标和先修

先完成第21章，知道程序使用虚拟地址，不把它直接当物理地址。本章学完应能带单位计算页号、偏移与物理地址；先检查范围、存在与权限；按小型两级表逐层定位；区分TLB未命中和缺页。

需要第04章整数运算、第05章数组遍历、第07章数组边界、第08章指针。二进制拆分会在本章重新推导，不要求先背CPU手册。

## 2. 页和页框分别在什么地方

**页page**是虚拟地址空间中的固定大小单位；**页框frame**是物理内存中对应大小的存放单位。**页表page table**记录虚拟页到物理页框的映射及访问状态。

页像固定大小的“逻辑格”，页框像可以放一格内容的“存储槽”。相邻虚拟页可以映射到不相邻页框，程序仍按连续虚拟地址使用。这个类比只解释固定单位和映射，不代表虚拟页号就是文件的行号。

本章先假定只有一种页大小，物理内存也按这个大小划分；真实体系结构可能支持多种页大小与更复杂条目。

## 3. 用16字节空间画四格

设虚拟空间只有16字节，页大小4字节：

| 虚拟页号 | 覆盖的虚拟字节地址 | 页内偏移 |
| --- | --- | --- |
| 0 | 0、1、2、3 | 0、1、2、3 |
| 1 | 4、5、6、7 | 0、1、2、3 |
| 2 | 8、9、10、11 | 0、1、2、3 |
| 3 | 12、13、14、15 | 0、1、2、3 |

**页内偏移**表示在这一页内部距离起点多少字节。地址13位于第3页，页起点12，距离为1。页号从0开始，不把“第3页”口语理解成数组下标2。

## 4. 除法和余数从哪里来

`地址 = 页号 × 页大小 + 页内偏移`，且偏移处于0到页大小-1。因此：页号=地址整除页大小；偏移=地址对页大小取余。

对13和4：`13 / 4 = 3`，`13 % 4 = 1`；反算`3×4+1=13`。先反算一次，能发现许多页号和单位混乱。跨页边界时，地址15是页3偏移3，地址16已经超出本模型虚拟空间，不能继续索引只有4项的表。

## 5. 从页号找到页框

本小节页表：0→5、1→2、2→7、3→1，所有项都假定有效且可读写。页3映射到物理页框1，所以地址13对应`1×4+1=5`。

注意保留的是页内偏移1，换掉的是页号。不是把虚拟地址13再加页框号，也不是把页框1误读成“物理字节地址1”。每次写公式都标清单位：页框编号×字节/页框+字节偏移，结果才是物理字节地址。

## 6. 主线的完整微型模型

平台Linux/WSL Ubuntu，Bash目录`~/os-lab/memory`。

[完整源码：paging.c](示例代码/paging.c)

```c
/* Model only: not a real page table. */
#include <stdio.h>

int main(void) {
    unsigned address = 13;
    unsigned page_size = 4;
    unsigned frames[] = {5, 2, 7, 1};
    unsigned page = address / page_size;
    unsigned offset = address % page_size;
    printf("page=%u offset=%u physical=%u\n",
           page, offset, frames[page] * page_size + offset);
    return 0;
}
```

编译运行：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic -Werror -g paging.c -o paging
./paging
```

预期`page=3 offset=1 physical=5`。frames只是普通C数组，没有访问CPU真实页表。固定address在合法范围；把它改成任意外部输入以前，必须先加范围和状态检查。

## 7. 二进制拆分不是另一套算法

4=2²，所以一页需要低2位表示0—3偏移。13的四位二进制是1101，可拆为`11 | 01`：高两位11是页号3，低两位01是偏移1。

如果页大小4096=2¹²，低12位为偏移。32位虚拟地址剩20位表示虚拟页号。这是除法余数在2的幂边界上的位表示，不是“所有系统页号一定20位”。

本课先用/和%实现，便于审查范围。将来改为位移和掩码时，也必须保证页大小满足对应假设，不能把非2次幂页大小套入同样位数拆分。

## 8. 页表不只存一个页框号

真实映射还需要表达是否属于有效映射、是否驻留、读写执行权限、是否被访问或修改等信息，具体编码依硬件与内核设计而异。

为避免把不同体系结构的位名混用，下面自定义四个独立字段：mapped表示属于本模型已分配范围；present表示当前驻留；writable表示允许写；frame是驻留时的页框号。它们是教学字段，不声称真实硬件都有同名的四个成员。

## 9. 有检查的完整翻译程序

本节**更换页表**：页0驻留且可写，映射框5；页1属于映射但未驻留；页2驻留框7但只读；页3未映射。页大小仍为4。

**完整程序：translate-checked.c**

```c
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct Entry { int mapped, present, writable; unsigned frame; };

int main(int argc, char *argv[]) {
    if (argc != 3 || (strcmp(argv[2], "r") != 0 && strcmp(argv[2], "w") != 0)) {
        fputs("usage: translate-checked ADDRESS_0_TO_15 r|w\n", stderr);
        return 2;
    }
    char *end;
    errno = 0;
    long parsed = strtol(argv[1], &end, 10);
    if (errno != 0 || end == argv[1] || *end != '\0' || parsed < 0 || parsed > 15) {
        fputs("address must be from 0 to 15\n", stderr);
        return 2;
    }
    const struct Entry table[4] = {
        {1, 1, 1, 5}, {1, 0, 1, 0}, {1, 1, 0, 7}, {0, 0, 0, 0}
    };
    unsigned address = (unsigned)parsed;
    unsigned page = address / 4, offset = address % 4;
    const struct Entry *entry = &table[page];
    if (!entry->mapped) { fputs("unmapped_page\n", stderr); return 3; }
    if (strcmp(argv[2], "w") == 0 && !entry->writable) {
        fputs("write_not_allowed\n", stderr);
        return 4;
    }
    if (!entry->present) { fputs("page_fault=not_resident\n", stderr); return 5; }
    printf("page=%u offset=%u frame=%u physical=%u access=%s\n",
           page, offset, entry->frame, entry->frame * 4 + offset, argv[2]);
    return 0;
}
```

编译为translate-checked。这里只有模拟分类，没有真的产生硬件缺页或对非法地址读写。3/4/5是本程序自己选的状态码，不是Linux固定的内核错误码。

## 10. 四条路径分别验收

在本批Bash目录执行，每条后立即用`echo $?`看状态：

```bash
./translate-checked 1 w
./translate-checked 5 r
./translate-checked 9 w
./translate-checked 13 r
```

第一条成功，页0偏移1、框5、物理地址21、退出0；第二条未驻留，退出5；第三条写只读页被拒，退出4；第四条未映射，退出3。另用地址16、-1或abc测试用法/范围错误，退出2，不能先用错误页号访问数组再补检查。

未驻留的已映射页可能由内核补齐后继续；未映射或权限错误也需要系统判断怎样处理，不能把一切异常都当作“找块空内存就修好”。本程序的分支只是把需要检查的事实列清。

## 11. 单级表为什么可能很大

假设32位虚拟地址、4KiB页面、每项4字节。虚拟页总数为2²⁰，一张覆盖全部范围的单级表需`2²⁰×4=2²²`字节，即4MiB。

这里KiB=1024字节，MiB=1024KiB。算的是**表自身**的空间，不是程序全部数据页，也不是每个Linux进程真实固定消耗。稀疏地址空间只使用少量区域，却为所有可能页预留完整单级表，可能浪费。

## 12. 多级表按目录逐层找

多级页表把页号再拆分。一部分定位上级目录，另一部分定位下级表；没用到的范围可以不配置相应下级表。代价是未缓存翻译时可能多走几层。

微型两级模型采用8位虚拟地址、16字节页：低4位偏移，高4位页号再分为2位目录和2位表内索引。地址165二进制10100101，拆为`10 | 10 | 0101`，即目录2、表项2、偏移5。

若这个叶表项为框9，物理地址`9×16+5=149`。范围、各层是否存在和权限仍要检查，分层不取消这些责任。

## 13. 两级行走的完整代码

**完整程序：walk-two-level.c**

```c
#include <stdio.h>

int main(void) {
    const unsigned leaf0[4] = {1, 4, 7, 2};
    const unsigned leaf2[4] = {3, 6, 9, 5};
    const unsigned *directory[4] = {leaf0, NULL, leaf2, NULL};
    const unsigned addresses[] = {0, 165, 64, 255};
    for (size_t i = 0; i < sizeof addresses / sizeof addresses[0]; i++) {
        unsigned page = addresses[i] / 16;
        unsigned outer = page / 4, inner = page % 4, offset = addresses[i] % 16;
        if (directory[outer] == NULL) {
            printf("address=%u directory=%u no_table\n", addresses[i], outer);
            continue;
        }
        unsigned frame = directory[outer][inner];
        printf("address=%u directory=%u entry=%u offset=%u physical=%u\n",
               addresses[i], outer, inner, offset, frame * 16 + offset);
    }
    return 0;
}
```

编译为walk-two-level。地址0得到物理16，165得到149；64和255分别遇到目录1、3没有下级表。这里NULL表示模型没有配置该范围，不是可直接解引用的表。固定输入全在0—255，扩展外部输入仍需先检查。

## 14. 分层到底节省在哪里

另回32位、4KiB、4字节项的假设，可以将20位页号拆成10位目录+10位叶索引。目录1024项占4KiB，每张叶表也占4KiB。

如果使用区域只落在两个目录项下、各需一张叶表，表空间是目录4KiB+两叶8KiB=12KiB，而非完整单级4MiB。这里忽略其他元数据和数据页。若地址空间很密，多级也可能需要许多叶表，不能无条件宣称永远省同样比例。

## 15. TLB缓存的是翻译

**TLB**是翻译后备缓冲，常可理解为近期地址翻译的缓存，保存虚拟页到页框及相关权限等信息。它不是存放完整应用数据页的普通数据缓存。

命中后仍需按权限进行访问；未命中表示要寻找翻译，并不自动说明数据页不在内存。真实系统还要区分地址空间上下文，可能使用标识或必要失效操作，不能拿进程A的同页号翻译直接给B用。

下面只模拟一个地址空间、2条全相联TLB项、FIFO替换，所有页表项已驻留可读。全相联表示可在任一缓存槽查找目标翻译；不模拟真实CPU组相联、并行流水和多级TLB。

## 16. 只出现TLB未命中的完整模型

**完整程序：tlb-model.c**

```c
#include <stdio.h>

int main(void) {
    const unsigned addresses[] = {0, 1, 4, 5, 8, 0, 9};
    const unsigned frames[4] = {5, 2, 7, 1};
    int cached[2] = {-1, -1};
    int next = 0, hits = 0, misses = 0;
    for (size_t i = 0; i < sizeof addresses / sizeof addresses[0]; i++) {
        unsigned page = addresses[i] / 4, offset = addresses[i] % 4;
        int hit = cached[0] == (int)page || cached[1] == (int)page;
        if (hit) { hits++; }
        else {
            misses++;
            cached[next] = (int)page;
            next = (next + 1) % 2;
        }
        printf("address=%u page=%u tlb=%s physical=%u\n",
               addresses[i], page, hit ? "hit" : "miss", frames[page] * 4 + offset);
    }
    printf("tlb_hits=%d tlb_misses=%d page_faults=0\n", hits, misses);
    return 0;
}
```

编译运行，7次访问中hit=3、miss=4，page_faults=0是本模型“全部驻留”的前提结果。虚拟页序列为0、0、1、1、2、0、2，先手填两格缓存再核对。物理地址依次20、21、8、9、28、20、29。

## 17. TLB未命中、缺页与错误的区别

| 事件 | 这里缺了什么 | 是否必然读磁盘 |
| --- | --- | --- |
| TLB miss | 翻译缓存里没有所需项 | 否，页表与数据可都在RAM |
| 已映射页未驻留 | 当前需补齐相应访问条件 | 否，可能分配零页或COW等 |
| 权限/未映射访问 | 请求不符合当前映射规则 | 否，可能拒绝并通知进程 |

不同体系结构可能以不同异常分类和机制处理上述情况，本课不把某CPU专有位名推广为统一术语。第23章再讨论需要回收页面时选择谁离开的策略。

## 18. 一个明确简化的耗时演算

假设TLB查询1ns、一次内存访问100ns，单级页表额外读一次内存；全部串行，无缓存重叠、无缺页，命中率90%。命中101ns，未命中201ns，平均`0.9×101+0.1×201=111ns`。

若改为两级且未命中需额外两次内存访问，未命中301ns，平均121ns。真实CPU有缓存、并行遍历等，这不是实测延迟。目的在于学习按事件概率加权，不能把模型数字贴到真实应用性能报告。

## 19. 常见错误、练习与参考答案

常见错法：页号与页框互换；物理地址漏乘页大小；页内偏移重新翻译；先索引表后查范围；把TLB miss说成必读交换文件；算页表空间时把4字节和4KiB混用。

练习一：页大小4096、地址8197。答案页号2、偏移5；若映射框9，物理36869。

练习二：8位两级模型中地址170。答案页号10、目录2、叶索引2、偏移10、物理9×16+10=154。

练习三：translate-checked地址8读和写结果？读页2偏移0、物理28；写拒绝，退出4。

练习四：上节单级模型命中率100%与0%？分别101与201ns，只在声明假设下成立。

练习五：TLB-hit但不允许写能否继续？不能，缓存命中不取消权限检查。把这些计算先写出中间项，再对答案。

## 20. 完成条件与资料

能独立完成两组地址演算，解释检查先于访问，画两级索引，逐步填TLB表，带前提计算平均耗时。所有程序模型都未修改真实页表或TLB。

原理参考作者教材[OSTEP Paging](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf)与[TLBs](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf)，核验2026-11-05。本章例子、字段、表格和程序自行设计。下一章：[缺页、页面置换与抖动](23-缺页置换与抖动.md)。
