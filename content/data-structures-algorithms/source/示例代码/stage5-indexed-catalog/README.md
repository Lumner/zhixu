# 内存索引目录v0.3a

[第30章](../../30-索引与主数据一致性.md)解释主记录、ID→下标、先准备后提交及其成本。[全量源码](../stage5-common/完整源码.md)含入口与依赖。它与 [v0.2文件目录](../stage2-catalog/README.md)是独立工程，不覆盖前版，也未接入文件导入导出或稳定排序。

目录最多48条，ID0—9999、分钟0—1440、标题1—63字节、零终止且无ASCII控制字节；不做UTF-8有效性验证。ID相等拒绝重复，get/find只复制结果；结构修改重建索引，失败保留全部旧状态，删除保持剩余顺序。头文件暴露字段用于教学，正常调用不手改结构。

下载本目录main.c、catalog.c/h，及相邻27-matching的matching.c/h、29-open-addressing的open_map.c/h、stage5-common的hash_status.h，放到自己的`~/dsa-labs/ch30`。只取这里的main，别取其他演示入口。在 **UCRT64 Bash、该目录**：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic main.c catalog.c open_map.c matching.c -o catalog.exe
./catalog.exe
./catalog.exe "Queues"
./catalog.exe ""
```

固定样本17、1、9导入后删17，再改9分钟为25。默认输出id=9 minutes=25 title=Queues，随后title_match=1 byte=12，最后count=2 index_count=2，各占一行。标题模式大小写敏感，空模式匹配所有现存标题；输出按主数组顺序。模式超过64字节返回非零状态并报catalog: pattern length；多余参数报usage。

ID查询用散列，标题查询逐条KMP；当前每条标题重建前缀表。新增/删除每次完整重建以保持简单失败保证，不宣称常数时间写入。本目录保留独立索引部分；[第六阶段整合v0.3](../stage6-catalog/README.md) 已接入文件与稳定视图，按阶段分别运行。
