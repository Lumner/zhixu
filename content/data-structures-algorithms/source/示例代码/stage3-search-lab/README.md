# 查找对照实验台：运行说明

这是第三阶段17—20章的综合练习参考，不修改第二阶段的资料目录。平台主线Windows x64、MSYS2 UCRT64 Bash，语法C17，无第三方依赖。

把本目录 [main.c](main.c) 与相邻20-search目录的 [search.h](../20-search/search.h)、[search.c](../20-search/search.c) 复制到自己的`~/dsa-labs/stage3`同一目录。在 **UCRT64 Bash、这个目录**：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic main.c search.c -o search_lab.exe
printf '6\n1\n3\n3\n3\n8\n12\n' | ./search_lab.exe 3
```

输出：

```text
count=6 target=3
lower=1
linear=1 comparisons=2 found=1
binary=1 comparisons=4 found=1
```

旧MinGW的标准格式兼容选项见第09章；不把源码改成平台专属格式。作者运行环境见 [第三阶段验证记录](../../验证/第三阶段验证记录.md)。

目标由一个命令行参数提供，0—9999；输入第一行count为0—128，其后count行值为0—9999，均只接受数字且必须非递减。允许前导零、最后一行无换行。空行、负号、空格、杂字、缺值和无序输入返回1，错误写stderr。正常结果写stdout，状态0。读取指定数量后不检查额外行，不是任意二进制与完整I/O故障诊断工具。

index=count表示精确匹配不存在，found用index<count计算；lower是第一个≥target的位置，允许等于count，此时不得读数组元素。comparisons只数元素与目标之间的<或==，不含读入、顺序校验、循环条件、打印。

完整入口解读见 [第三阶段答案](../../第三阶段-参考答案.md)，共享查询实现解读见 [第20章](../../20-顺序查找与二分边界.md)。不要把两份含main的search_demo.c和本入口一起链接；它们是两个独立程序。
