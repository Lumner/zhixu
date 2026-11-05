# 10 文件、错误、Make 与调试

> **零基础详细版 · 已重写。** 先完成第08—09章的指针、结构体与所有权。本章建议分四次学习，连同文件实验、Make、GDB和综合练习约8—11小时。每次先确认当前目录，只操作本次允许创建的练习文件。

## 10.1 从运行中的数据走到文件

前面动态数组在程序结束前由你释放。如果希望下次运行还能读回学习记录，需要按某种格式把内容写入文件，再在下一次运行中读取和校验。

这里有两个不同问题：怎样调用文件接口，以及文件里面的字节按什么规则解释。接口不替你决定哪一行是分钟、哪些内容合法。综合练习会把二者组合。

本章先用C标准库的文件流学习打开、读写、检查与关闭。它是建立在系统服务上的接口，和后面第14章的整数文件描述符有联系，但不是可以互相随意替换的同一种参数。

## 10.2 建立独立目录，避免读写错对象

在Ubuntu Bash执行：

```bash
mkdir -p ~/os-lab/lesson10
cd ~/os-lab/lesson10
pwd
```

相对路径以运行时的当前工作目录为起点，不以.c源文件保存在电脑的哪里为起点。你从另一个目录启动同一可执行文件，它读取的相对路径就可能指向另一处。

每次实验用本章自己的新输出名。已存在输出被拒绝时先理解原因，不通过切换为覆盖模式消除提示，也不删除不明来源的文件。

## 10.3 main也能接收参数：argc与argv

**完整程序：arguments.c**

```c
#include <stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "usage: arguments FIRST SECOND\n");
        return 2;
    }
    printf("argc=%d first=%s second=%s\n", argc, argv[1], argv[2]);
    return 0;
}
```

编译后运行 `./arguments input.txt output.txt`，应输出argc=3 first=input.txt second=output.txt。这里尚未打开任何文件，只观察Shell交给程序的参数字符串。

argc是参数数量，通常包括argv[0]这项程序名信息；argv是参数字符串指针数组，argv[1]与argv[2]才是本例两个用户参数。argv[argc]是终止指针，不是另一个可随意输出的参数字符串。

先检查argc再访问对应下标。少参数时应该显示用法并返回2，不等到非法访问发生才猜原因。路径含空格时需要Shell按引号规则传成一个参数，程序内部接收后不会再次按空格自动拆开。

## 10.4 FILE*是流句柄，不是文件内容

stdio.h声明FILE类型及相关接口。`FILE *file = fopen(path, mode);` 尝试打开路径并建立流，成功得到可用于后续操作的句柄，失败返回NULL。

这个指针不直接指向你要读的第一字节，也不能用*file=某个字符来写文件。流对象由库管理，要通过fgetc、fread、fwrite等接口操作。

与动态对象所有权类似，成功打开就获得一份需要关闭的资源。关闭后不继续使用旧流；打开失败则没有成功的那份流可关闭。

## 10.5 打开模式先决定会不会覆盖

| 模式 | 当前教学用途 | 已存在时的重要行为 |
| --- | --- | --- |
| r | 读取文本 | 从开头读，通常要求文件存在 |
| w | 写文本 | 会截断已有内容 |
| a | 追加文本 | 写到末尾，不能当作任意修改位置 |
| wx | 创建新文本文件 | 已存在则失败，防止意外覆盖 |
| rb | 二进制读取 | 按字节内容处理 |
| wbx | 创建新二进制输出 | 已存在则失败 |

本课采用C17，使用从C11已有的独占创建x。本章默认新文件输出，不用w覆盖你的旧笔记。[fopen接口说明](https://man7.org/linux/man-pages/man3/fopen.3.html)

b在Linux上通常不产生Windows那样的文本换行转换差异，但写清二进制用途有助于表达接口意图。它不自动校验内容格式，也不把任意数据变成可读文字。

## 10.6 完整写文件：成功打开不代表全部成功

**完整程序：write-note.c**

```c
#include <stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "usage: write-note NEW_FILE\n");
        return 2;
    }
    FILE *file = fopen(argv[1], "wx");
    if (file == NULL) {
        perror("open new file");
        return 1;
    }
    int failed = 0;
    if (fputs("My saved note\n", file) == EOF) {
        fprintf(stderr, "Write failed\n");
        failed = 1;
    }
    if (fclose(file) == EOF) {
        fprintf(stderr, "Close failed\n");
        failed = 1;
    }
    return failed;
}
```

保存并编译write-note.c，然后执行 `./write-note saved-note.txt`。正常时可能没有终端文字，紧接着echo $?应为0，`cat saved-note.txt`显示My saved note。

第二次用相同名字运行应失败，既有文件不被清空。fputs失败时仍关闭成功打开的流；关闭本身也可能在刷新待写内容时失败，所以它的返回值不能忽略。

本程序报告失败时，输出文件可能存在但不完整。它不是事务保存协议，也不以“文件已经出现”代表内容已完整或能抵御断电。

## 10.7 完整读文件：字符与EOF怎样区分

**完整程序：read-note.c**

```c
#include <stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "usage: read-note INPUT\n");
        return 2;
    }
    FILE *file = fopen(argv[1], "r");
    if (file == NULL) {
        perror("open input");
        return 1;
    }
    int failed = 0;
    int ch;
    while ((ch = fgetc(file)) != EOF) {
        if (fputc(ch, stdout) == EOF) {
            fprintf(stderr, "Output failed\n");
            failed = 1;
            break;
        }
    }
    if (ferror(file)) {
        fprintf(stderr, "Read failed\n");
        failed = 1;
    }
    if (fclose(file) == EOF) {
        failed = 1;
    }
    if (fflush(stdout) == EOF) {
        failed = 1;
    }
    if (failed) {
        fprintf(stderr, "Read or output did not complete\n");
    }
    return failed;
}
```

运行 `./read-note saved-note.txt`应显示同样笔记。fgetc返回int，可以表达读到的字节值或EOF，不能先缩成char再可靠区分结束。

循环里的赋值表达式把本次结果交给ch，再与EOF比较。外层括号明确先完成赋值，不是让ch接收真假判断的0/1。

EOF作为返回结果并不独自说明“正常到结尾”，也可能有读取错误，需要检查ferror。不要写while(!feof(file))然后无条件处理下一次读取：结束标记通常要在实际读到末尾后才有信息。

## 10.8 一块一块读：fread与fwrite的数量单位

复制任意文件不能靠strlen，因为内容可能含零字节，也不保证带字符串终止符。fread将一批字节放入缓冲区，返回实际读入的完整项数。

`fread(buffer, 1, sizeof buffer, in)`把每项大小设为1，因此本例返回项数也等于字节数。若每项大小改成4，返回2表示2项，不是2字节，不能继续拿原公式理解。[fread/fwrite接口说明](https://man7.org/linux/man-pages/man3/fread.3.html)

fwrite也返回实际写出的项数，必须与预期核对。短写不应该被安静当作成功；要么按特定协议恢复，要么像本教学工具一样报告本次失败。

## 10.9 完整复制器 copy.c

[完整源码：copy.c](示例代码/copy.c)

```c
#include <stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "usage: copy INPUT NEW_OUTPUT\n");
        return 2;
    }
    FILE *in = fopen(argv[1], "rb");
    if (in == NULL) { perror("input"); return 1; }
    FILE *out = fopen(argv[2], "wbx");
    if (out == NULL) { perror("new output"); fclose(in); return 1; }
    unsigned char buffer[4096];
    size_t n;
    int failed = 0;
    while ((n = fread(buffer, 1, sizeof buffer, in)) > 0) {
        if (fwrite(buffer, 1, n, out) != n) { failed = 1; break; }
    }
    if (ferror(in)) { failed = 1; }
    if (fclose(in) != 0) { failed = 1; }
    if (fclose(out) != 0) { failed = 1; }
    if (failed) { fprintf(stderr, "Copy failed; output may be partial\n"); }
    return failed;
}
```

代码看起来比单字符读取紧凑，是因为把多个检查放在同一行；阅读时仍按“检查参数→打开输入→打开新输出→循环读写→检查读取→关闭双方→返回状态”拆开。

unsigned char缓冲区用于字节数据，不把每一块当%s字符串。最后一块可能只有几十字节，fwrite只写本次n，不把整个4096字节旧缓冲都写出去。

## 10.10 用长度变化跟踪复制循环

假设文件有10000字节，缓冲区4096，正常读取可能按4096、4096、1808推进，再读到0结束。总计10000，不因最后不足一块就丢掉尾部。

空文件第一轮就没有正文可写，但新输出也应是合法空文件。恰好4096字节需要正确处理下一次检查，不能在“上一块刚好装满”后凭感觉推断还有数据。

| 输入长度 | 检验重点 |
| --- | --- |
| 0 | 不凭空写入任何字节 |
| 1 | 单字节不丢失 |
| 4095 | 不足一块 |
| 4096 | 恰好一块 |
| 4097 | 越过缓冲边界 |
| 10000 | 多轮与最后短块 |

只复制一句文字不能证明二进制零字节和多轮边界都正确，测试要对应你宣称支持的输入。

## 10.11 从终端运行并比较实际内容

先把本节完整代码保存为copy.c，Ubuntu Bash执行：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic -g copy.c -o copy
printf 'first\nsecond\n' > input-demo.txt
./copy input-demo.txt output-demo.txt
cmp input-demo.txt output-demo.txt
echo $?
```

本次input-demo.txt是可覆盖的练习输入，output-demo.txt应为尚不存在的新名。cmp无输出且退出0表示本次逐字节比较相同，不是“工具没有执行”。

再运行同一次copy，应拒绝已有目标。把源与目标写成相同路径，也应因新输出的独占创建要求失败，不先把输入截断。错误路径通常非零退出，不能只看屏幕是否出现文字判断成功。

## 10.12 资源清理按“已经拿到什么”判断

输入打开失败：没有输入流可用，直接报告。输入成功而输出失败：关闭已经打开的输入。双方成功：不论中途读取或写入是否失败，都处理双方关闭。

关闭失败后，该流也不能继续当作有效打开流重用。不要通过再fclose一次修复失败；保留错误结果，按应用协议决定后续动作。

更复杂程序可以采用集中清理结构，但核心仍是记录每份已获得资源的状态。下一份综合练习会把流与动态数组共同清理，不靠进程退出隐藏所有权不清晰的问题。

## 10.13 perror、errno和接口返回值

perror用当前errno对应信息补充错误说明。它适合本课Linux上约定会设置errno的失败接口，应在相关失败后尽快调用，避免中间其他操作改变错误状态。

不要先成功调用某函数，再读取旧errno宣布本次失败。也不要认为所有函数都是“返回-1并设置errno”：fread返回项数，malloc失败为NULL，后面的pthread接口常直接返回错误编号。

错误判断先读接口返回协议，再决定需要哪个错误标志或辅助信息。通用的“每行后面都perror一次”会制造误导。

## 10.14 把三类错误分开

编译或链接错误发生在生成程序时，例如漏分号、缺函数实现。运行错误发生在一次具体环境中，例如输入文件不存在、权限受限、分配失败。逻辑错误则可能让程序顺利退出却给错结果，例如少复制最后一块、循环漏一天。

排查顺序：先确认运行的是最新成功生成的程序；再确认参数、cwd和资源；最后用最小输入跟踪状态与预期。不同阶段的证据不同，不用一个“代码有问题”覆盖所有情况。

## 10.15 Make把构建依赖写进文件

每次手敲多个gcc命令容易漏文件。Make读取目标、前置依赖与构建配方，根据依赖是否需要更新决定执行哪些构建步骤。

在lesson10已有copy.c和arguments.c的前提下，建立下列文件。配方两行开头必须是实际Tab，不是若干空格。复制后若编辑器把Tab替换为空格，需要按该编辑器方式恢复。

**完整文件：Makefile**

```makefile
CC = gcc
CFLAGS = -std=c17 -Wall -Wextra -Wpedantic -g

all: copy arguments

copy: copy.c
	$(CC) $(CFLAGS) copy.c -o copy

arguments: arguments.c
	$(CC) $(CFLAGS) arguments.c -o arguments

.PHONY: all
```

在该目录运行make，通常会完成缺失或过期目标。再次make时，若依赖未变，可能显示无需处理。`make -B`可以明确请求强制重建，改了编译选项后不要盲目假设所有已有目标都会被自动重编译。

`$(CC)`和`$(CFLAGS)`是Make变量写法，不是Bash让你单独输入的命令。它与C变量也不是同一个语言环境。旧版完整例程目录另有自己的Makefile，使用时先确认当前是哪一份目录。

## 10.16 调试器让程序停下来观察

输出日志可以显示值，GDB则能在指定位置暂停、检查当前对象、单步推进。先看现象，再选一个要验证的假设，不在几十条随机命令之间碰运气。

本机有GDB时直接用；若没有且需要安装，可在Ubuntu用 `sudo apt install gdb`，具体安装仍受管理权限和网络条件约束。它是调试工具，不是编译每份程序的额外先修。

把第08章完整pointers.c另存到lesson10，保持与教程一致，然后：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic -g -O0 pointers.c -o pointers-debug
gdb ./pointers-debug
```

-g保留调试信息，-O0减少优化带来的源码与执行对应差异。不要把gdb命令粘进pointers.c。

## 10.17 一次完整断点观察

进入GDB提示符后，逐条输入：

```text
break swap
run
print *left
print *right
next
print saved
next
print *left
continue
quit
```

break swap设置在swap处暂停；run开始本次运行；暂停时left/right已指向main的a、b。最初读到10与20。第一次next执行saved初始化后，print saved应为10；再next完成*left=*right后，print *left应为20。

continue继续直到后续断点或结束，正常最终输出after=20,10。GDB可能显示$1、$2等结果编号，不是程序变量名字。next通常跨过函数调用，step可能进入函数，具体停顿仍受断点与信号等影响。[GDB单步说明](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Continuing-and-Stepping.html)

如果出现跟踪权限或调试环境限制，记录原始诊断，不通过更改系统安全策略强行消除。普通程序输出与调试器检查是不同验证层次。

## 10.18 内存诊断工具用于补充证据

可以将第09章records.c保存到本目录，编译独立诊断版本：

```bash
gcc -std=c17 -g -O0 -fsanitize=address,undefined -fno-omit-frame-pointer records.c -o records-check
./records-check
```

这会插入一些运行时检查，帮助发现无效访问等错误。它会增加开销，也受工具链和运行环境支持限制；一次没有报告不能证明所有路径都安全。[GCC运行时检查选项](https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html)

当前运行的是正常例程，不故意解引用释放后对象来猜结果。诊断版、普通版和GDB版各有用途，明确本次在运行哪个文件，再解释证据。

## 10.19 先做一份小型实验记录

记录Linux与GCC版本、源码名、完整命令、输入文件长度、退出码、输出比较结果。出错时还要记当前目录和第一条相关诊断。

例如“复制10000字节且cmp退出0”比“看起来复制成功”更可评估；“已有目标被拒绝且原内容仍在”比“出现一行错误”更完整。测试不需要堆数量，要对应支持范围。

## 10.20 练习与提示

题一：arguments没有提供两个参数时应怎样结束？为什么先检查argc？

题二：新建输出为什么使用wx或wbx，而不是为省事改成w？fclose为什么也要检查？

题三：复制4097字节时，为什么最后一次fwrite不能仍写4096？为什么不能对buffer使用strlen？

题四：把10000字节、空文件、已有目标、缺失源、错误参数分别列出预期状态与文件结果。

题五：在GDB里看见left指向10，next一次后saved为10，下一次后*left为20，这支持了swap中的哪两步推导？

## 10.21 参考答案与完成条件

题一：用法提示并非零退出，防止访问不存在参数。题二：新输出协议避免截断旧文件；关闭时待写缓存仍可能报错。题三：最后只有1个新字节，写整个缓冲会混入旧内容；任意二进制不依赖字符串终止符。题四：正常新目标与原字节一致；已有目标保持内容；源缺失不伪造成功；参数错误在使用路径前拒绝。题五：先暂存旧left，再把right值写到left目标。

完成条件：能从空目录准备并运行文件工具；解释每个成功打开对象在哪里关闭；验证至少两个缓冲边界与两条失败路径；使用Make构建一次，并通过GDB或明确记录环境限制完成一次状态观察。

接着完成 [第三批综合练习](详写第三批-练习与参考答案.md)，把输入校验、动态记录和新文件导出组合起来。下一批将开始第11—16章，把这些C工具基础连接到进程、系统调用和CPU调度。
