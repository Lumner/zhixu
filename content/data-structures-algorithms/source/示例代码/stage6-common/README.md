# 第六阶段：公共模块与七组完整工程

新增7组，累计41组。公共文件、各函数、测试器和源码附录不另计独立程序。平台主线仍为Windows x64、MSYS2 UCRT64 Bash、C17；真实验证用已有MinGW-w64 GCC8.1.0，未在本批重新安装环境。

## 公共5文件

- [sort.h](sort.h)：SItem、SortStats、状态与9种函数声明。
- [sort_internal.h](sort_internal.h)：实现共享辅助声明。
- [sort_common.c](sort_common.c)：验证、三路键比较、记录写入/交换。
- [demo.h](demo.h)、[demo.c](demo.c)：演示打印，不进入算法计数。

31—35章各自的两文件（一个实现.c与一个main.c）加公共5文件，放到自己的独立练习文件夹，即可使用正文的平铺编译命令。每章只取自己入口，不把多份main混放覆盖。完整文件见 [源码附录](完整源码.md)。

## 保持源码包布局时的命令

在 **UCRT64 Bash、累计包解压后的`source/示例代码`目录**：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage6-common 31-basic-sort/main.c 31-basic-sort/basic.c stage6-common/sort_common.c stage6-common/demo.c -o basic.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage6-common 32-insertion-shell/main.c 32-insertion-shell/insertion_shell.c stage6-common/sort_common.c stage6-common/demo.c -o insertion-shell.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage6-common 33-merge/main.c 33-merge/merge.c stage6-common/sort_common.c stage6-common/demo.c -o merge.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage6-common 34-quick/main.c 34-quick/quick.c stage6-common/sort_common.c stage6-common/demo.c -o quick.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage6-common 35-distribution/main.c 35-distribution/distribution.c stage6-common/sort_common.c stage6-common/demo.c -o distribution.exe
./basic.exe
./insertion-shell.exe
./merge.exe
./quick.exe
./distribution.exe
```

其余两组：[排序实验台](../stage6-lab/README.md)、[文件与索引目录v0.3](../stage6-catalog/README.md)，各有完整命令。`-I目录`指定头文件搜索位置，不会自动链接.c；每条命令只选择一个入口。旧MinGW若需要%zu兼容，在gcc后加`-D__USE_MINGW_ANSI_STDIO=1`，参见第09章。

## 全批统一约定

n最多128，正长度需可写数组，空数组可NULL；统计输出独立且不可NULL。比较排序支持所有int键；计数、桶、基数限-999—999。失败保留输入与统计，S_OK=0必须显式比较枚举名。比较计一次三路比较器调用；写入计输入/辅助SItem数组赋值，交换两处计2、标量与频数赋值不计。

本版稳定：冒泡、插入、归并、计数、桶、基数；不稳定：选择、希尔、三路快排。归并/分配式排序辅助数组由函数申请并释放，调用者只管理自己的输入。资料目录排序视图复制记录，不改主数据；文件最多32条，沿用旧协议，内存v0.3a的48项规则保留。

实际测试与未覆盖项见 [第六阶段验证](../../验证/第六阶段验证记录.md)。
