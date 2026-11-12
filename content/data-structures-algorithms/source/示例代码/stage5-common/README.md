# 第五阶段四组完整工程

本批新增4组，累计34组。共享头和源码附录不另计程序。平台主线：Windows x64、MSYS2 UCRT64 Bash、C17。代码只使用标准C库；真实验证机是已有MinGW GCC8.1.0，详见 [记录](../../验证/第五阶段验证记录.md)。

| 工程 | 文件组合 | 运行 |
| --- | --- | --- |
| 27 匹配对照 | 27-matching/main.c + matching.c/h | matching.exe，或两个带引号参数正文、模式 |
| 28 拉链映射 | 28-chaining/main.c + chaining.c/h + 本目录hash_status.h | chaining.exe，无输入 |
| 29 开放寻址 | 29-open-addressing/main.c + open_map.c/h + hash_status.h | open_map.exe，无输入 |
| 30 索引目录v0.3a | stage5-indexed-catalog/main.c + catalog.c/h + open_map.c/h + matching.c/h + hash_status.h | catalog.exe，可选标题模式参数 |

最适合初学者的方式是按每章下载所需文件到自己的独立练习文件夹，所有头和实现放一起，每次只选一个main。不要将四份main.c混放覆盖。完整文件逐字展示在 [源码附录](完整源码.md)。

如果已经下载累计源码包，在 **UCRT64 Bash、解压后的`source/示例代码`目录**，也可保留原布局：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic 27-matching/main.c 27-matching/matching.c -o matching.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage5-common 28-chaining/main.c 28-chaining/chaining.c -o chaining.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage5-common 29-open-addressing/main.c 29-open-addressing/open_map.c -o open_map.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage5-common -I29-open-addressing -I27-matching stage5-indexed-catalog/main.c stage5-indexed-catalog/catalog.c 29-open-addressing/open_map.c 27-matching/matching.c -o catalog.exe
./matching.exe
./chaining.exe
./open_map.exe
./catalog.exe
```

`-I目录`告诉编译器额外去哪找头文件；它不代替把.c实现加入编译。旧MinGW的%zu兼容见第09章，可在gcc后加`-D__USE_MINGW_ANSI_STDIO=1`。

H_OK、M_OK均为0，用枚举名比较。映射只接受0—9999键，48有效项预算；数组表容量8—64，阈值3/4；这些是本阶段自己的协议，不修改第四阶段的64项容器。所有拥有者先init后使用、最后clear，不复制后双重释放；输出变量与输入/内部存储分离。
