> 52章与最终v1.0已交付，最新验证见 [完整主线交接](integration-stage9b.md)。本页保留历史批次范围。

> 最新51章累计交付见 [第九阶段上交接](integration-stage9a.md)。本页保留历史批次验证范围。

> 第八阶段累计交付与验证请看 [最新交接](integration-stage8.md)。下文保留历史批次范围与检查数。

> 历史批次记录。当前累计交付与集成请看 [第七阶段交接](integration-stage7.md)。

# 第六阶段交接：九种排序与目录v0.3

日期2026-11-11。只编写content/data-structures-algorithms，未改其他课程、web、tools、依赖或根说明；dist由统一构建生成。没有启动其他作者，旧C源码与历史ZIP保持。

## 实际交付

新增六章详细正文：31排序规格/稳定性/选择与冒泡，32插入/希尔，33归并，34三路快排/小边递归，35计数/桶/LSD基数，36实验/目录v0.3。每章有目标先修、定义、手算/不变量、完整核心C、终端目录命令、真实可复现输出、常见错误、练习答案与完成条件。

另有第六阶段独立练习与答案、公共构建说明、实验台与项目README、全量新源码附录、来源核验、实际验证脚本/C模型/受控分配器/结果/记录。例程目录新增23个C/H文件，组成7组完整工程；测试工具、共享模块、9个排序函数不重复计独立程序。

累计36章正文、41组完整工程、6个已交付阶段，status=ongoing；全课仍52章/9阶段，37—52仅规划。建议第六阶段42—60小时（含8—12小时练习），前六阶段196—279，全课预算265—381小时，包含手算和排错。

## 排序约定

n<=128，SItem为int key/tag，tag只作负载。比较排序允许所有int键，分配式限-999—999。一次comparisons计三路比较器调用，不是C关系表达式总数；writes计输入/辅助SItem数组写入，不计标量、频数、验证/复制/打印。不同位置交换计2写，自交换跳过。

失败保留输入与统计；归并、计数、桶、基数先申请辅助数组再改输入。稳定六种：冒泡/插入/归并/计数/桶/基数；选择/希尔/三路快排不稳定。希尔折半步长，快排确定中间位置值、三路分区，只递归小边限制栈，最坏时间仍二次。堆排序等待第41章讲堆后实现，未虚报本批包含。

分配式先全量验证键域后偏移+999，计数1999格，桶10个宽度200的连续区间、桶内插入，基数十进制四趟。报告R/B/d等成本，不把零比较解释成零工作或任意分布线性。

## 目录v0.3

stage6-catalog复用stage2-catalog文件解析器、stage5-indexed-catalog与open_map，以及matching/merge；io.h以相对路径区分两个catalog.h，原布局构建命令完整保留。适配层完成加载后索引提交，失败旧目录保持；导出先准备全部记录再写流，准备失败不输出，写流阶段仍可能部分输出。

稳定分钟视图以key=minutes/tag=原位置做归并，输出完整记录副本，不改主记录/ID索引。CLI有view/save/find/title/remove，覆盖查询、修改/删除后导出重载，没有交互菜单或新增CLI。文件沿用DSA-CATALOG-1，最多32条；内存v0.3a仍48条，超32内存目录保存会先CAT_LIMIT。无原子文件替换、Unicode合法性验证、并发/路线规划器功能。

## 实际验证

PowerShell、网站根目录：

```powershell
python content/data-structures-algorithms/source/验证/verify-stage6.py --cc D:\mingw\mingw64\bin\gcc.exe
npm run build
npm test
node content/data-structures-algorithms/source/验证/check-site.cjs
```

最终单课688项通过，runtimeOnly=false；实际MinGW-w64 GCC8.1.0、C17/Wall/Wextra/Wpedantic/Werror/O0，旧运行库ANSI stdio定义支持%zu。本批不重装工具。

93,123次排序对照：9,841个长度0—8三值数组*九算法，500组固定种子*九，五种128项*九，六种比较排序极端int，三种分配式端点。参考qsort以key/原位置建立唯一顺序；检查键序、完整记录多重集、六种稳定承诺及边界哨值。另核对手算操作数与协议失败保持。

0—32条文件各做加载/视图/索引/导出/重载，共33组。17个申请失败位置：四种辅助排序4、视图1、文件导入记录区/索引共8、导出准备4；最终指定模块跟踪存活申请0。归并相等取右、冒泡反向、计数丢身份三种安全错误变体均被测试拒绝。初轮漏写头文件搜索路径，修复验证器并将真实依赖写入教材后复测通过。

构建成功：5课程、172全站主线章、408文档、2990原始附件、27图，brokenMarkdownLinks为空。npm test通过841项、1525本地链接。本课数据集成86项通过，连续01—36 ID、6阶段、41工程、下载、目录/高亮、搜索及进度隔离均正常。

未实测浏览器视觉/手机/file:///复制、Linux/macOS/ARM、ASan/Valgrind、超大数据耗时、并发与真实设备读写/刷新/关闭失败，browserQA=false。无共享构建器改动，未重复test:extension。

## 累计包与注册

downloads/data-structures-algorithms-stage6.zip，194条、402530字节，包含完整source和AUTHORING.md；CRC与每条字节比对通过，不含exe/o/tmp。历史stage1—5包保留。SHA256：9CEC2F7112EAFD109EE4D6DDD09D2900B24383B9ACB25591C30076378D66FC8C。

course.json在正文、例程、答案、验证和包完成后更新，download指向stage6；原01—30章节ID/课程ID稳定，新增sorting组31—36。机器打包结果在stage6-package-checks.json，网页结果在site-integration-checks.json；两者位于课程根，不参与累计源码包自引用。

## 后续

下一批37—42树、遍历、BST、AVL插入/树种概览、堆/优先队列/堆排序、哈夫曼。先写所有权、空/单节点、重复键、容量与失败保证，再用独立例程实现。不得修改此前容器/排序/文件预算来凑实验；全课最终v0.8/v1.0仍未完成。
