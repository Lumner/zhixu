# 排序对照实验台

这是第六阶段第6组工程，对应 [第36章](../../36-排序实验与资料目录v0.3.md)。一次使用相同32项输入分别运行9种排序，每次先复制原件；算法计数不含生成、复制、验证和打印。输入预算仍是教学规模，不宣称完成大数据耗时基准。

保持累计包的完整目录布局。在 **UCRT64 Bash、解压后的`source/示例代码`目录**：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage6-common -Istage6-lab \
  stage6-lab/main.c stage6-lab/experiment.c stage6-common/sort_common.c \
  31-basic-sort/basic.c 32-insertion-shell/insertion_shell.c 33-merge/merge.c \
  34-quick/quick.c 35-distribution/distribution.c -o sort-lab.exe
./sort-lab.exe all mixed
./sort-lab.exe insertion sorted
./sort-lab.exe insertion reverse
./sort-lab.exe quick equal
```

反斜杠是Bash续行符，后面直接换行，不加空格。也可以合并为一条长命令。PowerShell不使用这种续行方式；维护者可运行课程Python验证脚本。

算法名：selection、bubble、insertion、shell、merge、quick、counting、bucket、radix；all运行全部。数据名：sorted、reverse、equal、nearly、mixed。名称区分大小写，参数错误非零退出，不静默回退。

insertion sorted的完整输出为`insertion sorted n=32 comparisons=31 writes=31 verified=1`；reverse变为496与527；quick equal为32与0。verified只代表这次数据通过了有序、完整记录多重集和该算法稳定承诺检查。检查器独立在排序之后运行，最坏O(n²)，不计入算法两列。

完整文件：[experiment.h](experiment.h)、[experiment.c](experiment.c)、[main.c](main.c)；共享算法与全文在 [源码附录](../stage6-common/完整源码.md)。维护者的参考排序/故障注入见 [验证](../../验证/第六阶段验证记录.md)。
