# 第九阶段上：六组完整例程

对应49—51章。累计包保留相邻目录；C17、Windows MSYS2 UCRT64 Bash。新C/H全文见 [附录](完整源码.md)，实际检查见 [验证](../../验证/第九阶段上验证记录.md)。这是六组独立程序，不是已完成的最终资料规划器。

## 文件组合

所有入口都使用公共 [design.h](design.h)，它仅定义容量和错误状态。

| 入口 | 还需哪些C/H | 作用 |
| --- | --- | --- |
| [49活动main.c](../49-interval/main.c) | [interval.h](../49-interval/interval.h)、[interval.c](../49-interval/interval.c) | 最早结束安排，含稳定的确定性排序规则 |
| [49零钱main.c](../49-change/main.c) | [coins.h](../49-change/coins.h)、[greedy.c](../49-change/greedy.c) | 有解非最优、局部卡住反例 |
| [50子集main.c](../50-subset/main.c) | [subset.h](../50-subset/subset.h)、[subset.c](../50-subset/subset.c) | 全枚举/安全剪枝，方案与节点对照 |
| [50数独main.c](../50-sudoku/main.c) | [sudoku.h](../50-sudoku/sudoku.h)、[sudoku.c](../50-sudoku/sudoku.c) | 4×4行列宫约束，计数与首解 |
| [51零钱coin_main.c](../51-dp/coin_main.c) | 49的coins.h、[coins.c](../51-dp/coins.c) | 记忆化/表格、恢复与不可达 |
| [51背包pack_main.c](../51-dp/pack_main.c) | [knapsack.h](../51-dp/knapsack.h)、[knapsack.c](../51-dp/knapsack.c) | 二维恢复/倒序滚动价值 |

## 保留布局编译

在 **MSYS2 UCRT64 Bash、解压后的`source/示例代码`目录**，逐组执行：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage9-common 49-interval/main.c 49-interval/interval.c -o activity.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage9-common 49-change/main.c 49-change/greedy.c -o greedy-change.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage9-common 50-subset/main.c 50-subset/subset.c -o subset.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage9-common 50-sudoku/main.c 50-sudoku/sudoku.c -o mini-sudoku.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage9-common -I49-change 51-dp/coin_main.c 51-dp/coins.c -o min-change.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage9-common 51-dp/pack_main.c 51-dp/knapsack.c -o pack01.exe
./activity.exe
./greedy-change.exe
./subset.exe
./mini-sudoku.exe
./min-change.exe
./pack01.exe
```

`-I`负责找头文件，不会替你链接.c；每组只选一个main，不把六个入口一起编译。平铺复制时不得把同名main覆盖，先为每组单独建立练习目录。旧MinGW格式输出兼容见第09章；实际作者环境并非新安装的MSYS2。

## 接口与容量

活动/子集/物品最多8项；活动时间0—60，start<end、ID唯一。子集值0—20、目标0—160，按位置区分方案，最多256份；pruning只接0/1，非负是剪枝前提。

面额最多8种、1—20严格降序，金额0—60；每种无限使用。贪心D_STUCK只说明本路径卡住，out保持。两种最优零钱算法返回D_OK后以possible区分可达/不可达；possible=0时total=0只是占位。金额0为空方案。

背包费用1—60、价值0—100、预算0—60，每位置最多一次。二维返回value/cost/mask；同价值不取较后物品，不承诺最少费用。滚动只返回value，没有方案恢复。

数独固定4×4、2×2宫、0为空、1—4为数字；错误题面返回状态，合法无解返回D_OK/solutions=0。首解仅在solutions>0有效；会继续计数，不把首解当唯一解证明。

全部使用局部/值数组，无malloc；输入由调用者保持有效，输入和输出须独立，不手改内部工作状态。失败保持旧输出，成功无解是新结果。n=0的数组可NULL，out不可NULL。全部主线例程没有命令行参数或标准输入，修改固定样例须重新编译。
