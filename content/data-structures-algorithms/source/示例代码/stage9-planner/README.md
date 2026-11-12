# 学习资料检索与路线规划器v1.0

对应 [第52章](../../52-综合项目资料检索与路线规划.md)。这是新增一组完整工程，累计63组，复用旧模块但不修改旧版。C17、Windows MSYS2 UCRT64 Bash；全新六份C/H见 [完整源码](完整源码.md)，严格数据格式见 [协议与输出](协议与输出.md)，实际运行范围见 [验证](../../验证/第九阶段下验证记录.md)。

## 构建目录与完整命令

下载累计包并解压到自己的练习副本，保持全部相邻目录。在 **UCRT64 Bash、解压后的`source/示例代码`目录**执行，不能只下载stage9-planner六文件后省略前批依赖：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic \
  -Istage6-common -Istage5-common -I29-open-addressing \
  -I27-matching -Istage7-common -Istage8-common \
  -Istage9-planner \
  stage9-planner/main.c stage9-planner/app.c stage9-planner/relations.c \
  stage9-planner/query.c stage6-catalog/io.c stage6-catalog/view.c \
  stage2-catalog/catalog.c stage5-indexed-catalog/catalog.c 29-open-addressing/open_map.c \
  27-matching/matching.c 33-merge/merge.c stage6-common/sort_common.c \
  stage8-common/graph.c 45-topological/topological.c 46-shortest/path.c \
  46-shortest/dijkstra.c 41-heap/heap.c \
  -o planner.exe
```

反斜杠是Bash续行，也可合成一行。旧MinGW的%zu兼容见第09章，需加-D__USE_MINGW_ANSI_STDIO=1；推荐的MSYS2工具链无需因作者旧版本而降级。程序没有新第三方C库。

## 文件与阅读顺序

| 新文件 | 作用 |
| --- | --- |
| [planner.h](planner.h) | 公共对象、容量、输出类型和API |
| [planner_internal.h](planner_internal.h) | 仅本项目使用的解析/映射适配接口 |
| [app.c](app.c) | 初始化/清理、数字、候选加载/提交、分钟修改/导出、错误转换 |
| [relations.c](relations.c) | 有界逐行读取、字段拆分、两阶段引用/树/图验证 |
| [query.c](query.c) | 目录视图、标题匹配、分类遍历、拓扑/就绪/路线适配 |
| [main.c](main.c) | 命令参数、正常/错误输出、退出状态与资源清理 |

旧依赖是文件目录、ID散列索引、KMP、稳定归并、图、拓扑、Dijkstra/恢复和小根堆。查询数据来自当前App；没有缓存过期视图或就绪队列。

## 运行样例

仍在 **UCRT64 Bash、`source/示例代码`目录**：

```bash
./planner.exe stage9-planner/catalog.txt stage9-planner/relations.txt check
./planner.exe stage9-planner/catalog.txt stage9-planner/relations.txt list
./planner.exe stage9-planner/catalog.txt stage9-planner/relations.txt find 0
./planner.exe stage9-planner/catalog.txt stage9-planner/relations.txt title "C"
./planner.exe stage9-planner/catalog.txt stage9-planner/relations.txt categories
./planner.exe stage9-planner/catalog.txt stage9-planner/relations.txt order
./planner.exe stage9-planner/catalog.txt stage9-planner/relations.txt ready 0
./planner.exe stage9-planner/catalog.txt stage9-planner/relations.txt route 0 202
./planner.exe stage9-planner/catalog.txt stage9-planner/relations.txt route 0 9999
```

check为`records=4 categories=3 study=4 places=4`；list按分钟输出ID9999,9,0,17，同分钟0在17之前。order为`order=0,9,17,9999`；ready 0为`ready=9,17`；route 0 202为`cost=5 path=0,101,202`，0到9999为`unreachable`。

`ready`不带完成ID时仅0就绪；ready 9999因未完成先修而失败。这里资料ID0和地点ID0属于不同映射，不能混同。

## 更新、导出和重载

以下**重定向也在UCRT64 Bash执行**，输出文件名必须与输入不同：

```bash
./planner.exe stage9-planner/catalog.txt stage9-planner/relations.txt minutes 0 20 > updated-catalog.txt
./planner.exe updated-catalog.txt stage9-planner/relations.txt list
./planner.exe stage9-planner/catalog.txt stage9-planner/relations.txt export > exported-catalog.txt
./planner.exe exported-catalog.txt stage9-planner/relations.txt check
```

重载updated后列表顺序为9999,0,9,17。minutes/export的stdout是原目录协议，不是人读表格；list/find/title的输出不能作为目录再次加载。程序不直接覆写输入文件，shell会先创建/截断重定向目标，所以不能将目标写成输入路径。

## 空配置

[empty-catalog.txt](empty-catalog.txt)和[empty-relations.txt](empty-relations.txt)只有各自协议头。将样例路径换为这两个文件，check得到全0、list为no matches、categories为empty categories、order/ready为empty。空目录也允许合法的空分类和独立地点图；每个非空分类集合仍须是一棵树。

## API与保证

先planner_init，再调用加载/查询，最后planner_clear；可在clear后重复clear或重新加载，不可对仍拥有索引的对象再次init。Planner不是可随意浅拷贝后分别clear的普通值；唯一动态拥有资源为catalog.index，其他映射为值数组且只存整数下标/ID。

planner_load借用两个可读FILE*，不关闭它们、不回滚流位置；失败保留旧App。planner_load_files拥有自己打开的流，连两次关闭都成功后才提交，否则候选释放、旧App保持。所有输出参数与输入对象独立；查询失败输出保持。不要手改App字段破坏不变量。

分钟修改先验证范围与ID，再单个标量提交，无需申请候选副本；查询按需重建视图和堆，不存在需要回滚的派生缓存。导出失败不撤销此前成功的内存修改；写入/刷新失败可能留下部分输出，不提供原子覆盖。错误统一stderr、退出1；正常结果及不可达/无匹配为stdout、退出0。

## 范围

文件32条，ID0—9999、分钟0—1440、标题1—63字节；分类8、标签1—31字节，学习网络8、地点8、道路0—1000。标题/标签按UTF-8字节约定，不做完整Unicode验证。网络节点须显式声明，其他目录资料仍可检索但不参与order/ready。

本版有文本命令，无交互菜单、增删资料/关系命令、关系文件导出、原子保存、压缩、账户或有依赖的预算最优。旧v0.3删除功能保留；独立背包、数独等仍为算法例程，未为凑功能塞入应用。限制不影响本课已约定的v1.0检索/分类/先后/就绪/路线/修改导出验收。
