# 最终交接：52章与学习资料规划器v1.0

日期2026-11-12。课程ID/data目录稳定为data-structures-algorithms，沿用systems分类和本地静态站点。仅维护本课目录；未手改dist、其他课程、web/tools、根说明、依赖或站点配置。dist由串行build生成，未启动其他作者或新建托管站点。

## 真实完成范围

新增第52章20个小节，解释业务ID/图位置、数据建模、两文件协议、候选加载/验证/所有权交换、API适配、构建、检索/稳定列表、一般分类树、拓扑/先修闭包/就绪堆、零权路线、分钟修改/序列化重载、失败保证、结构选择与成本、独立验证、常见错误、练习答案和完成条件。约15,000字符（含完整app.c和构建命令），不是任务提纲。

独立stage9-planner新增6份生产C/H：planner.h、planner_internal.h、app.c、relations.c、query.c、main.c。链接共17个生产.c，只有一个main，统计新增完整工程1组。复用旧目录/索引/KMP/稳定归并、堆、Graph/Kahn/Dijkstra与路径恢复，不修改旧模块。另有两份正常/两份空输入、运行说明、协议页、六文件全文、独立练习/答案、三份测试C与测试头、执行器、机器结果及真实验证记录。

全课52章/9阶段/63组完整程序，稳定章节ID01—52、algorithm-design分组扩展49—52，status=complete。complete指约定基础主线和v1.0已交付，不表示读者自动掌握、工业级应用或所有平台已验收。第52章16—24小时含练习，第九阶段49—71，全课339—482小时含手推/手打/排错。

## 最终接口与范围

目录协议保持DSA-CATALOG-1：32条、ID0—9999、分钟0—1440、标题1—63字节；不改旧内存48项预算。关系侧文件DSA-RELATIONS-1，C/M/S/D/P/R区块，分类8、学习节点8、地点8、标签1—31字节、道路0—1000。标签/标题按UTF-8字节约定，不做完整Unicode验证。

类别一般树以父关系数组表示，一根/父存在/无环，允许空目录空类别或合法无资料类树；每资料恰好一归属。S显式选择学习图节点，D端点必须参与且整体DAG；R无向、反向视同边、零权/自环允许。资料、类别、地点ID分别映射，0合法。

命令check/list/find/title/categories/order/ready/route/minutes/export全部运行。ready完成集合须先修闭合，当前候选按分钟/ID，不自动消费或宣称预算最优。分类前序按声明孩子顺序，类内主顺序；order不承诺ID字典序最小。路线输出业务ID，未知端点与不可达分别为错误/正常结果。

Planner唯一动态拥有catalog.index.slots，无内部自指或指向嵌入记录的借用地址，受控swap_owners核对后转移；不允许任意复制后双clear。load借流不回滚位置，load_files在自有两流关闭成功后才提交。分钟修改验证后标量提交，无派生缓存，每次查询新建视图/堆；导出失败不回滚先前内存修改或文件已写部分。没有原子覆盖。

本版无交互菜单、资料/关系增删CLI、关系导出、并发账户、压缩、负权业务路由、依赖预算最优。原需求允许菜单或文本命令，此处落实文本命令。旧v0.3删除及独立数独/背包等保留，不冒充新工具功能。没有虚构独立v0.8完整版，阶段基础需求在v1.0整合。

## 实际验证

PowerShell、网站根目录执行：

```powershell
python content/data-structures-algorithms/source/验证/verify-stage9b.py --cc D:\mingw\mingw64\bin\gcc.exe
npm run build
npm test
node content/data-structures-algorithms/source/验证/check-site.cjs
```

最终正式单课1235项通过，runtimeOnly=false；MinGW-w64 GCC8.1.0、C17/Wall/Wextra/Wpedantic/Werror/O0、旧ANSI stdio兼容。未新装MSYS2。检查包括本课Markdown链接、app.c正文逐字核对、六文件附录一致及实际C执行。

88 CLI场景核对stdout/stderr/退出码；512张三点有向图用排列参考检查依赖DAG和业务ID顺序，200份完成集合核对闭包/就绪；64张无向权图、576端点查询用简单路径参考；701种0—4类父关系核对一般树与深度。32条/8类/8学习点/8地点/最长标题标签/28DAG边/36含自环道路的组合边界实际运行。

申请失败：32条加载8个真实位置；默认4条导出1个、32条导出4个；视图1个。检查旧App/输出、未写协议、资源基线；最终指定模块live=0。10受控I/O场景为两读取、两关闭、两打开缺失、三写入位置、一刷新；自有流streams=0。包装先真实关闭再报模拟错误，未伪造设备拔出或磁盘耗尽。

旧MinGW会内联格式输出，最终注入在临时catalog.c副本显式命名p_fprintf/p_fflush，避免普通宏替换被绕过；正式源码未改。测试临时文件全部在Python创建并核验父目录/前缀的任务目录，不依赖旧tmpfile默认目录。四个安全逻辑变体（错误仍提交、ready/route泄漏位置、漏闭包）被独立模型拒绝。

真实排序样本30/20/20：3次键比较、10次SItem写入，来自SortStats；不是全部指令/内存/I/O，也未用它声称整程序耗时提升。所有查询/恢复均用真实文件与旧模块运行。

最终build：5课程、188主线章、450文档、3139原始附件、31图，失效Markdown链接0。npm test通过925项、2023本地链接。本课网页数据145项通过，52连续ID、9阶段/63例程、complete状态、搜索、目录/高亮、进度隔离和第37/45/50/52章实际SVG生成均检查。

## 完整累计包

downloads/data-structures-algorithms-complete.zip包含全部source与AUTHORING.md，328条、705756字节。CRC、文件集合与逐文件字节核对通过，无exe/o/tmp/pyc。SHA256：BA519CF53F5715D9CE1636C9BB0DD918416323B1F27125836F0CFE742125DBBB。

对照stage9a历史包，前批178份C/H逐字节保持；stage9a包SHA256仍为6CB2ABF85CC838EB9471D7D2ED5CE98CB10937C179A3C4A004F051C80131DD4B。所有旧ZIP保留，新完整包独立命名。内容、结果与包完成后才最后注册course.json为52/63/complete，并统一构建。

complete-package-checks.json、site-integration-checks.json位于课程根；本集成记录与author-tools不进入源码包，避免包自引用。源验证记录/机器结果随包保留，原阶段记录保持原日期和范围，没有把历史测试改成“本次全跑”。

## 限制与维护

浏览器视觉/窄屏/file://和复制未验收，browserQA=false；生成/数据检查不替代视觉验证。未实测Linux/macOS/ARM、新装推荐工具链、ASan/Valgrind、大规模/并发、真实设备故障或CLI最终stdout系统故障。模拟覆盖实际错误分支，有限小模型不证明所有业务输入；旧未改例程的全部历史穷举未在本次重复运行。

基础课程与最终工程已完成。后续修订先读AUTHORING、运行说明/协议与真实记录，保持稳定ID/编号、原文件格式和旧例程。新增专题或扩展功能另定范围，不通过改当前完成计数或覆写旧课程来虚构交付。
