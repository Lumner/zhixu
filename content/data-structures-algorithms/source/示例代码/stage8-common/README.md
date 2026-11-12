# 第八阶段八组图例程

本阶段新增8组，累计56组。函数、共享头和测试模型不重复算完整程序。主线环境Windows x64、MSYS2 UCRT64 Bash、C17；真实验证用已有MinGW-w64 GCC8.1.0，未本批重装工具。

## 公共文件与每章组合

公共三文件：[graph.h](graph.h)、[graph_internal.h](graph_internal.h)、[graph.c](graph.c)。单章平铺练习复制它们和对应章文件，按正文编译。完整新源码在 [附录](完整源码.md)。

| 工程 | 专属文件 | 备注 |
| --- | --- | --- |
| 43 存储 | [main.c](../43-graph/main.c) | 矩阵/邻接表、逻辑边与弧 |
| 44 遍历 | [walk.h](../44-traversal/walk.h)、[walk.c](../44-traversal/walk.c)、[main.c](../44-traversal/main.c) | DFS/BFS、无向分量 |
| 45 拓扑 | [topological.h](../45-topological/topological.h)、[实现](../45-topological/topological.c)、[main.c](../45-topological/main.c) | 有向环拒绝、输出保持 |
| 46 Dijkstra | [shortest.h](../46-shortest/shortest.h)、[内部头](../46-shortest/shortest_internal.h)、[path.c](../46-shortest/path.c)、[dijkstra.c](../46-shortest/dijkstra.c)、[main.c](../46-shortest/main.c) | 全图非负前提、恢复单源路径 |
| 47 Bellman-Ford | 复用46的两个头和path.c，加 [bellman.c](../47-negative-paths/bellman.c)、[bellman_main.c](../47-negative-paths/bellman_main.c) | 源可达负环影响 |
| 47 Floyd | 复用46的两个头和path.c，加 [floyd.c](../47-negative-paths/floyd.c)、[floyd_main.c](../47-negative-paths/floyd_main.c) | 全点对三态，无路径恢复矩阵 |
| 48 森林 | [dsu.h](../48-spanning/dsu.h)、[dsu.c](../48-spanning/dsu.c)、[spanning.h](../48-spanning/spanning.h)、[spanning.c](../48-spanning/spanning.c)、[main.c](../48-spanning/main.c) | Kruskal/Prim、断开/负权 |
| 关系网络实验台 | [main.c](../stage8-graph-lab/main.c)，复用45/46 | [完整运行说明](../stage8-graph-lab/README.md) |

每条编译命令只选一个main。不要把同名入口覆盖到同一文件夹；Bellman/Floyd各是独立组，不能把两个入口一起链接。

## 保留累计包布局时编译

在 **UCRT64 Bash、解压后的`source/示例代码`目录**，逐个选择命令：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage8-common 43-graph/main.c stage8-common/graph.c -o graph.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage8-common 44-traversal/main.c 44-traversal/walk.c stage8-common/graph.c -o walk.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage8-common 45-topological/main.c 45-topological/topological.c stage8-common/graph.c -o topological.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage8-common 46-shortest/main.c 46-shortest/path.c 46-shortest/dijkstra.c stage8-common/graph.c -o dijkstra.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage8-common -I46-shortest 47-negative-paths/bellman_main.c 47-negative-paths/bellman.c 46-shortest/path.c stage8-common/graph.c -o bellman.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage8-common -I46-shortest 47-negative-paths/floyd_main.c 47-negative-paths/floyd.c 46-shortest/path.c stage8-common/graph.c -o floyd.exe
gcc -std=c17 -Wall -Wextra -Wpedantic -Istage8-common 48-spanning/main.c 48-spanning/dsu.c 48-spanning/spanning.c stage8-common/graph.c -o spanning.exe
./graph.exe
./walk.exe
./topological.exe
./dijkstra.exe
./bellman.exe
./floyd.exe
./spanning.exe
```

-I只指定找头文件，不能代替.c实现。旧MinGW的%zu兼容按第09章加-D__USE_MINGW_ANSI_STDIO=1。

## 统一边界

V<=8、顶点0..n-1、权重-1000..1000，允许自环，拒绝重边；无向反向视作同一条。has与weight分开，0权合法。输入对象通过init构造，不手改不变量；输出独立，错误保持。所有对象含数组/整数，可值复制，不申请动态内存。

距离仅FINITE可读；UNREACHABLE/NEGATIVE不能读占位值。Dijkstra拒绝全图任意负边；Bellman/Floyd成功分析时仍可能带负环影响状态。Floyd用阶段快照以便解释边界，不输出路径矩阵。分量/MST拒绝有向；断开无向图返回森林，负边可用、自环不选。

本批矩阵实现按矩阵成本报告，不宣传稀疏邻接表性能或堆版Dijkstra。八组含固定图CLI实验，不是最终资料目录/分类树/图文件整合。真实范围见 [第八阶段记录](../../验证/第八阶段验证记录.md)。
