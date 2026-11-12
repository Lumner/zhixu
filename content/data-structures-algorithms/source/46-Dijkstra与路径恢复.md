# 46 非负最短路、Dijkstra与路径恢复

## 46.1 目标与先修

先完成BFS、优先级选择和图权重，建议6—9小时。目标是区分边数与权和、暂定与确定距离，手推松弛，解释非负前提，恢复路径并明确不可达。

**最短距离**是所有可选路线的边权之和的最小值。这里最短不一定经过最少顶点；BFS只保证最少边。若负环可从起点到达且还能通往目标，反复绕环会让成本无限下降，第47章再标记这种情况。

## 46.2 三种状态，不拿大整数冒充无穷

Shortest保存n、source、state、distance、parent。state为PATH_UNREACHABLE、PATH_FINITE或PATH_NEGATIVE；只有FINITE时distance可当最终数值。未达distance格可能是0占位，不表示零成本路线。

本章Dijkstra成功输出只有有限/不可达；负环状态供下一章共用。parent=GRAPH_MAX表示无前驱，源点也是此值，源到自己距离0、恢复路径只含源。0权边与0距离都合法。

## 46.3 松弛：发现一条更便宜的路线

**松弛relaxation**是尝试用u到v的边改进v：若u已有可达距离，候选为distance[u]+weight[u][v]；v未达或候选更小，就更新距离与parent[v]=u。

不从不可达出发相加；不因候选相等就改parent。本版严格改进，避免零权环中无意义地互改前驱。每个有限暂定值都对应实际已发现路线，但开始时不保证最短。

## 46.4 Dijkstra每轮确定谁

从未确定且可达的顶点中，选暂定距离最小的u，标done；再松弛它发出的边。源暂定0，其余未达。若找不到可达未确定点，就停止，剩余保持不可达。

为什么非负时能确定？任何绕经尚未确定顶点的新路线，走到那个顶点前的成本不会小于当前最小暂定值，之后再加非负边不会更低。因此u无需以后翻案。

有负边时结论失效：0→1=2、0→2=5、2→1=-10，过早确定1为2会错过-5。本接口扫描全图，任何负权边（包括源不可达部分）都返回G_NEGATIVE并保留out，不让调用者误把输入不适用当成“部分计算完成”。

## 46.5 完整手算表

入口使用5点有向图：0→1=4、0→2=1、2→1=2、1→3=1、2→3=5，4孤立。U表示未达：

| 已确定动作 | d0 | d1 | d2 | d3 | d4 |
| --- | --- | --- | --- | --- | --- |
| 初始 | 0 | U | U | U | U |
| 选0，松弛 | 0 | 4 | 1 | U | U |
| 选2，松弛 | 0 | 3 | 1 | 6 | U |
| 选1，松弛 | 0 | 3 | 1 | 4 | U |
| 选3，结束可达部分 | 0 | 3 | 1 | 4 | U |

parent[3]=1、parent[1]=2、parent[2]=0。不是把暂定6一直保留；它在更便宜路线发现后被4替换。

## 46.6 完整Dijkstra实现

接口 [shortest.h](示例代码/46-shortest/shortest.h)，完整文件dijkstra.c：

```c
#include "shortest_internal.h"
GStatus graph_dijkstra(const Graph *graph, size_t source, Shortest *out)
{
    if (graph == NULL || out == NULL || source >= graph->n) { return G_INVALID; }
    for (size_t u = 0; u < graph->n; u++) {
        for (size_t v = 0; v < graph->n; v++) { if (graph->has[u][v] && graph->weight[u][v] < 0) { return G_NEGATIVE; } }
    }
    Shortest next; graph_paths_begin(&next, graph->n, source); int done[GRAPH_MAX] = {0};
    for (size_t step = 0; step < graph->n; step++) {
        size_t u = GRAPH_MAX;
        for (size_t v = 0; v < graph->n; v++) {
            if (!done[v] && next.state[v] == PATH_FINITE && (u == GRAPH_MAX || next.distance[v] < next.distance[u])) { u = v; }
        }
        if (u == GRAPH_MAX) { break; }
        done[u] = 1;
        for (size_t v = 0; v < graph->n; v++) {
            if (!graph->has[u][v] || done[v]) { continue; }
            long cost; GStatus status = graph_cost_sum(next.distance[u], graph->weight[u][v], &cost);
            if (status != G_OK) { return status; }
            if (next.state[v] == PATH_UNREACHABLE || cost < next.distance[v]) {
                next.state[v] = PATH_FINITE; next.distance[v] = cost; next.parent[v] = u;
            }
        }
    }
    *out = next; return G_OK;
}
```

选择扫描按编号，距离相等时保留先选者，得到确定的一份最短路径树；不承诺列出所有最优路径。所有计算放next，最后一次性提交，参数/前提/算术检查失败不改*out。

## 46.7 从parent恢复一条路径

完整文件path.c包含共用初始化、状态名称与恢复：

```c
#include "shortest_internal.h"
void graph_paths_begin(Shortest *paths, size_t n, size_t source)
{
    *paths = (Shortest){0}; paths->n = n; paths->source = source;
    for (size_t i = 0; i < GRAPH_MAX; i++) { paths->parent[i] = GRAPH_MAX; }
    paths->state[source] = PATH_FINITE;
}
const char *path_state_name(PathState state)
{
    switch (state) { case PATH_UNREACHABLE: return "unreachable"; case PATH_FINITE: return "finite"; case PATH_NEGATIVE: return "negative"; default: return "invalid"; }
}
GStatus graph_path(const Shortest *paths, size_t target, GraphPath *out)
{
    if (paths == NULL || out == NULL || target >= paths->n) { return G_INVALID; }
    if (paths->state[target] == PATH_UNREACHABLE) { return G_MISSING; }
    if (paths->state[target] == PATH_NEGATIVE) { return G_NEGATIVE; }
    GraphPath next = {0}; size_t reverse[GRAPH_MAX], n = 0, current = target;
    for (;;) {
        if (current >= paths->n || n == paths->n) { return G_INVALID; }
        reverse[n++] = current;
        if (current == paths->source) { break; }
        current = paths->parent[current];
    }
    next.count = n; next.cost = paths->distance[target];
    for (size_t i = 0; i < n; i++) { next.vertices[i] = reverse[n - 1 - i]; }
    *out = next; return G_OK;
}
```

从target反向收集直到source，再倒序复制。未达G_MISSING、负环影响G_NEGATIVE，失败保留旧GraphPath；有限路径记录顶点数与总成本。反向最多收n个点，前驱越界或成环返回G_INVALID，避免无限循环。

paths应来自成功算法调用，不随意手填元数据；输入/输出独立，不能把路径输出覆盖回前驱数组。Floyd只提供全点对状态与距离，本恢复接口使用单源前驱，不承诺Floyd路径恢复。

## 46.8 long与相加边界

本课有限简单路径最多7边、每边绝对值1000，绝对成本<=7000，候选再接一边<=8000。用long并以%ld输出；仍统一调用graph_cost_sum在相加前检查界限，不给不存在的“无穷值”做算术。

这份预算是正确性的一部分。若以后改到百万顶点或巨大权重，要重做范围推导和失败语义，不直接把数组上限改大继续宣称已验收。

## 46.9 编译、运行与输出

将 [公共三文件](示例代码/stage8-common/README.md)、shortest.h、[shortest_internal.h](示例代码/46-shortest/shortest_internal.h)、[path.c](示例代码/46-shortest/path.c)、dijkstra.c与[main.c](示例代码/46-shortest/main.c) 放自己的`~/dsa-labs/ch46`。在 **UCRT64 Bash、该目录**：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic main.c graph.c path.c dijkstra.c -o dijkstra.exe
./dijkstra.exe
```

预期：

```text
cost=4 path=0,2,1,3
vertex4=unreachable
```

矩阵选最小与扫邻居各做至多V轮，总O(V²)，工作结果O(V)。这里不使用堆；第41章有优先队列不意味着可以省略接入接口就写成堆版复杂度。路径恢复O(V)。

## 46.10 常见错误

选下一点时按边权而非暂定总距；BFS深度当权和；未达格0参与最小选择；负权仍使用；用固定大数当无穷并相加；相等时反复改前驱；倒序路径直接打印；负环或未达仍输出distance占位；错误后把旧out当新结果。

## 46.11 练习与参考答案

练习一：为何先选2而非1？答案：暂定距离1小于4，不因编号小先选。

练习二：源到自己恢复几项？答案：一项source、cost0，不能输出空路径冒充未知。

练习三：不可达的孤立负自环也会拒绝Dijkstra吗？答案：本接口会，明确选择全图非负前提；Bellman-Ford才区分源可达的负环影响。

## 46.12 完成条件

能手推暂定/确定过程、举负权反例、解释三态和前驱恢复，运行样本及不可达查询。下一章处理负边与全点对。
