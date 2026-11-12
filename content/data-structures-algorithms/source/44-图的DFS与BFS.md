# 44 图的DFS、BFS与连通分量

## 44.1 目标与先修

先完成图、递归、栈和队列，建议6—8小时。目标是防止有环图重复访问，跟踪DFS/BFS，区分DFS树深与最少边数，并为无向图标连通分量。

树中父子路径唯一，图可能绕回。直接照搬树递归而不记已发现状态，0—1—0便可能无限往返。图遍历先要回答“谁已发现”。

## 44.2 一个源点的可达范围

本章从source出发，只返回沿方向可达者，不自动跳到孤立部分。邻居按编号递增扫描，保证示例顺序可复现。Walk含order、parent与depth；未达parent/depth为GRAPH_MAX=8，不是0。

源点parent=8、depth=0。source必须<n，空图不可选0；错误不改out。输出是值副本，之后改图不会自动更新旧Walk。

## 44.3 DFS：先深入再回头

**深度优先搜索DFS**访问当前顶点后，沿第一个未发现邻居递归，走不动返回找其他路。先标邻居depth/parent再递归，避免环重新进入它。

样本无向5顶点，边0—1、0—3、1—2、2—3，4孤立。DFS从0依次0→1→2→3，回到0时3已发现，不重复。parent形成搜索树，原图仍含其他边。

## 44.4 DFS树深不保证最短

上例depth[3]=3，因为DFS树走0、1、2、3；原图0—3只需一条边。DFS规定深入次序，不保证最少边或最小权。

parent只还原这次发现的树。不能因为某个算法保存parent，就把它的结果自动称为最短路。

## 44.5 BFS：一层层扩展

**广度优先搜索BFS**用队列，源先入，出队后把未发现邻居加到队尾：

| 出队 | 新发现 | 队列剩余 |
| --- | --- | --- |
| 0 | 1、3 | 1,3 |
| 1 | 2 | 3,2 |
| 3 | 无，2已发现 | 2 |
| 2 | 无 | 空 |

输出0,1,3,2，depth[3]=1、depth[2]=2。入队就标发现，不拖到出队才标；否则多条前驱边可能重复入队，破坏8格预算。

## 44.6 为什么BFS给出最少边数

队列先处理深度k层，再处理新入的k+1层。首次发现v时若存在更少边的路，其前驱应更早出队并发现v，与首次发现矛盾，所以depth是最少边数。

仅当每边同成本或只数边时适用。直达权100、绕两边各1，BFS偏爱直达的少边，却不是最小权；第46章另讲带权方法。

## 44.7 无向连通分量

无向图中相互可达的一组叫连通分量。从最小未标顶点做BFS，标一组，再处理下一未标点。样本0—3一组，孤立4自己一组，共2；空无向图0组，无边n顶点n组。

graph_components拒绝有向图：单向可达不对称，不能当等价分组。强/弱连通分量有别的定义和算法，本函数未实现。

## 44.8 完整实现与边界

接口 [walk.h](示例代码/44-traversal/walk.h)，完整文件walk.c：

```c
#include "walk.h"
static void prepare(Walk *walk, size_t n, size_t source)
{
    *walk = (Walk){0}; walk->n = n; walk->source = source;
    for (size_t i = 0; i < GRAPH_MAX; i++) { walk->depth[i] = walk->parent[i] = GRAPH_MAX; }
    walk->depth[source] = 0;
}
static void visit(const Graph *graph, size_t u, Walk *walk)
{
    walk->order[walk->count++] = u;
    for (size_t v = 0; v < graph->n; v++) {
        if (graph->has[u][v] && walk->depth[v] == GRAPH_MAX) {
            walk->parent[v] = u; walk->depth[v] = walk->depth[u] + 1; visit(graph, v, walk);
        }
    }
}
GStatus graph_dfs(const Graph *graph, size_t source, Walk *out)
{
    if (graph == NULL || out == NULL || source >= graph->n) { return G_INVALID; }
    Walk next; prepare(&next, graph->n, source); visit(graph, source, &next); *out = next; return G_OK;
}
GStatus graph_bfs(const Graph *graph, size_t source, Walk *out)
{
    if (graph == NULL || out == NULL || source >= graph->n) { return G_INVALID; }
    Walk next; prepare(&next, graph->n, source); size_t queue[GRAPH_MAX], head = 0, tail = 0;
    queue[tail++] = source;
    while (head < tail) {
        size_t u = queue[head++]; next.order[next.count++] = u;
        for (size_t v = 0; v < graph->n; v++) {
            if (graph->has[u][v] && next.depth[v] == GRAPH_MAX) {
                next.depth[v] = next.depth[u] + 1; next.parent[v] = u; queue[tail++] = v;
            }
        }
    }
    *out = next; return G_OK;
}
GStatus graph_components(const Graph *graph, Components *out)
{
    if (graph == NULL || out == NULL || graph->directed) { return G_INVALID; }
    Components next = {0}; next.n = graph->n;
    for (size_t i = 0; i < GRAPH_MAX; i++) { next.label[i] = GRAPH_MAX; }
    for (size_t u = 0; u < graph->n; u++) {
        if (next.label[u] != GRAPH_MAX) { continue; }
        Walk walk; (void)graph_bfs(graph, u, &walk);
        for (size_t i = 0; i < walk.count; i++) { next.label[walk.order[i]] = next.count; }
        next.count++;
    }
    *out = next; return G_OK;
}
```

prepare先把所有parent/depth设8，再设源深0。DFS/BFS依据depth判断未发现。队列每点最多入一次，单次工作不需绕回。component调用BFS前已知source合法，因此明确忽略不可能的参数错误。

参数先验证，结果在局部next完成后提交；无动态分配或malloc失败路径。输入/输出独立，不能手改Walk元数据再当有效结果使用。

## 44.9 编译、输出与成本

将 [公共三文件](示例代码/stage8-common/README.md)、[walk.h](示例代码/44-traversal/walk.h)、[walk.c](示例代码/44-traversal/walk.c)、[main.c](示例代码/44-traversal/main.c) 放自己的`~/dsa-labs/ch44`。在 **UCRT64 Bash、该目录**：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic main.c graph.c walk.c -o walk.exe
./walk.exe
```

预期：

```text
dfs=0,1,2,3
bfs=0,1,3,2
depth3 dfs=3 bfs=1 components=2
```

不符时先核对边与扫描顺序，不排序输出掩盖问题。本版每访问一顶点扫V格，最坏Θ(V²)；邻接表版才常见O(V+E)。分量全覆盖也O(V²)，输出/队列/递归栈O(V)。固定数组实际大小与推广预算后的增长结论分开理解。

## 44.10 常见错误

递归/出队后才标发现；无visited不停绕环；parent=0作未达；只从0遍历就说覆盖全图；DFS深度当最短；BFS任意权仍说最短；有向单次遍历叫强连通分量；矩阵代码套邻接表复杂度。

## 44.11 练习与参考答案

练习一：4会出现在从0输出里吗？答案：不会；分量外层扫描才另起一次。

练习二：0→1、0→2、1→2，若出队才标2？答案：可能重复加入；入队即标避免它。

练习三：DFS次序不同必错吗？答案：邻居顺序不同可产生别的合法次序，但本版升序扫描须与固定预期一致，可达集合与不变量始终要正确。

## 44.12 完成条件

能手推队列/递归，区分两种depth，解释环、孤立点与有向限制并运行示例。下一章把箭头解释为先修要求。
