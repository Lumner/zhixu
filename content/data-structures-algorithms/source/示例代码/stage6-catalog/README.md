# 资料目录v0.3：文件、索引与稳定视图

对应 [第36章](../../36-排序实验与资料目录v0.3.md)，第六阶段第7组完整工程。复用 [v0.2文件目录](../stage2-catalog/README.md)、[v0.3a内存索引](../stage5-indexed-catalog/README.md)、第27章匹配与第33章归并；不修改前版，累计源码包包含全部依赖。新文件是 [view.h](view.h)/[view.c](view.c)、[io.h](io.h)/[io.c](io.c)、[main.c](main.c) 与 [sample.txt](sample.txt)。

## 编译

保留包中的相邻目录。在 **UCRT64 Bash、解压后的`source/示例代码`目录**：

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic \
  -Istage6-common -Istage5-common -I29-open-addressing -I27-matching \
  stage6-catalog/main.c stage6-catalog/view.c stage6-catalog/io.c \
  stage2-catalog/catalog.c stage5-indexed-catalog/catalog.c \
  29-open-addressing/open_map.c 27-matching/matching.c \
  33-merge/merge.c stage6-common/sort_common.c -o catalog-v3.exe
./catalog-v3.exe view stage6-catalog/sample.txt
./catalog-v3.exe find stage6-catalog/sample.txt 9
./catalog-v3.exe title stage6-catalog/sample.txt "C"
./catalog-v3.exe save stage6-catalog/sample.txt 1 30 > updated.txt
./catalog-v3.exe view updated.txt
./catalog-v3.exe remove updated.txt 17 > removed.txt
./catalog-v3.exe find removed.txt 9
```

反斜杠为Bash续行；可合成一行。旧MinGW的%zu兼容选项见第09章。两个catalog.c各自包含本目录对应的catalog.h；适配头用相对路径明确区分，不能在平铺复制时覆盖其中一个。

## 五种命令

| 模式 | 附加参数 | stdout |
| --- | --- | --- |
| view 文件 | 无 | 按分钟非递减的稳定记录副本，人读文本 |
| find 文件 ID | 一个0—9999 ID | 精确记录；缺失返回非零 |
| title 文件 模式 | 一个带引号的模式，0—64字节 | 按主序列逐条KMP匹配；空模式全部匹配 |
| save 文件 [ID 分钟] | 无，或ID和0—1440分钟 | 原主顺序的文件协议；可先修改已有ID分钟 |
| remove 文件 ID | 一个ID | 删除并重建索引后的文件协议；保持其余顺序 |

正常0退出，错误1，错误写stderr。view/find/title行格式为id=… minutes=… title=…，不能当协议再次导入。save/remove才输出DSA-CATALOG-1格式；重定向到与输入不同的新文件名，避免shell先截断输入。当前没有交互菜单或新增CLI；已有indexed_add API可用于后续扩展，保存仍受32条文件预算限制。

样本主顺序17/30、1/45、9/30、3/20；view为3、17、9、1。把ID1改30并保存重载，view为3、17、1、9，同分钟按原加入顺序。view不改主数组或ID索引；修改后旧视图副本不会自动更新，需要重建。

## 边界与保证

文件最多32条、ID0—9999唯一、分钟0—1440、标题1—63字节无ASCII控制，沿用v0.2的LF/CRLF、无BOM、UTF-8字节约定；不验证完整Unicode合法性。内存v0.3a仍最多48项，这里不修改它；v3_save收到超过32项立即CAT_LIMIT且未写流。

v3_load/v3_save的FILE*必须为调用者打开的有效可读/可写流，目录先indexed_init，最后indexed_clear；函数不关闭流。加载临时解析和索引完成后提交，失败旧目录保留，但流位置不回滚。输出先准备临时记录，准备失败不写流；写入或刷新失败可能部分输出，不提供原子文件替换。main在输出前检查输入关闭错误，在结束时检查stdout刷新；本批未模拟真实设备I/O/关闭失败。

catalog_view的输出数组与统计均独立，容量不足、参数错误、归并申请失败时输出保持；成功给副本。不得复制目录拥有者后双重释放，也不自行改records或index。完整源码见 [附录](../stage6-common/完整源码.md)，真实验证见 [记录](../../验证/第六阶段验证记录.md)。
