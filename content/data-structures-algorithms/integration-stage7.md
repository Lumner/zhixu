> 52章与最终v1.0已交付，最新验证见 [完整主线交接](integration-stage9b.md)。本页保留历史批次范围。

> 最新51章累计交付见 [第九阶段上交接](integration-stage9a.md)。本页保留历史批次验证范围。

> 第八阶段累计交付与验证请看 [最新交接](integration-stage8.md)。下文保留历史批次范围与检查数。

# 第七阶段交接：树、优先级与编码

日期2026-11-11。独占content/data-structures-algorithms；未改其他课程、web、tools、依赖或根说明。dist仅通过统一构建生成；未启动其他作者，前批C/H与历史stage1—6包保留。

## 已完成正文与例程

37树/二叉树/所有权，38前中后序/显式栈/层序，39BST增查删，40AVL插入与四类旋转，41二叉堆/优先队列/堆排序，42哈夫曼树/前缀编解码。六章均有先修目标、术语、分步演算、不变量、完整核心C、终端目录/命令/输出、错误、练习答案和完成条件。

另有独立第七阶段练习/答案、公共构建表、22个新例程C/H文件与源码附录、官方来源核验、两份C验证模型与Python执行器、真实结果/记录。22文件组成7组入口：树构造、遍历、BST、AVL、小根堆、堆排序、哈夫曼，函数/共享头/测试程序不重复计数。

累计42章详细正文、48组完整例程、7阶段；全课52章/9阶段框架保持，43—52仅规划。课程ongoing，现组trees-and-heaps覆盖37—42。第七阶段建议46—65小时（含练习8—12），前七242—344，全课预算286—410，包含手打与排错。

## 关键约定

树高空0/叶1，深度根0。普通二叉树允许重复值，63节点/带空前序127token，构建先候选后提交，失败保留旧树。遍历含3递归、3显式栈、层序，有界指针工作数组，输出不足先拒绝。拥有节点对象不能浅拷贝后分别clear。

BST/AVL唯一int键，重复先于满判断；BST有叶/单/双孩子删除，使用右子树最小后继，公开数量减一次。AVL缓存高度并逐节点平衡，只实现插入，不提供AVL删除；红黑/B树为概览，未统计完整例程。

MinHeap固定63项，priority升序再id升序，允许完全重复Job，不是同优先级FIFO，无decrease-key。数组对象不拥有指针，可值复制。heap_sort独立复用第六阶段SItem/n<=128/计数，不改旧sort.h或九算法实验台；大根堆升序，不稳定，额外记录空间常数。

Huffman最多8种字节、权重1—1000、15数组节点，消息64字节、位文本448。按最小权重和创建下标确定性合并，扫描选择O(s²)，没有强转旧Job堆。空表仅空输入；单符号码0；decode不补终止零，失败保留输出。位串字符尚未打包，不含压缩文件/码表序列化。

目录v0.3保持；本批未整合目录分类树/任务菜单或v0.8/v1.0，不能把独立基础例程当成最终路线工具。

## 实际验证

PowerShell、网站根目录完成：

```powershell
python content/data-structures-algorithms/source/验证/verify-stage7.py --cc D:\mingw\mingw64\bin\gcc.exe
npm run build
npm test
node content/data-structures-algorithms/source/验证/check-site.cjs
```

最终单课819项通过，runtimeOnly=false。实际编译MinGW-w64 GCC8.1.0，C17/Wall/Wextra/Wpedantic/Werror/O0，旧stdio ANSI兼容；不是新装环境。

626种小树形状对照token整数索引模型；5,914种插入排列逐步核对BST与AVL顺序/数量/真实高度/缓存；10,000步BST模型、20,000步堆模型；10,142组堆排序对照含确定128项边界与极端int。70个申请失败位置（候选树63、BST2、AVL5），旧根/内容/高度保持，指定模块追踪存活0，复用未修改的stage6受控分配器。

哈夫曼364份频数组用独立子集最优划分核对成本，5,461条含零/255消息回解，1,023位串用逐码字参考核对完整/截断；空/单、非法符号、容量、8符号8000总权重、64字节448位真实边界均执行。四种安全错误变体（BST后继取最大、旋转缓存错、堆同优先级反序、接受截断）被拒绝。

最终构建5课程、178主线章、419文档、3027原始附件、28图，失效Markdown链接0。npm test通过863项、1659本地链接。本课网页数据102项通过，含42连续ID、7组/48程序计数、正文目录/高亮、搜索与进度隔离。第37章图表初用graph语法退回代码块，改为本地支持的flowchart并确认实际SVG生成；网页数据测试增加该断言，随后重新打包/构建/复检。

浏览器视觉/手机/file:///复制未验收，browserQA=false；未实测Linux/macOS/ARM、ASan/Valgrind、超大深树、真实内存耗尽、并发或文件压缩格式。无共享构建器改动，不额外跑test:extension。源码/SVG生成检查不冒充视觉验收。

## 累计包

downloads/data-structures-algorithms-stage7.zip：231条，482135字节。包含全部source与AUTHORING.md，CRC及逐文件字节核对通过，无exe/o/tmp。course.json在完整内容/结果/包准备后注册，download指向stage7。

SHA256：6EC39AD2245AC1D2F92DF7028C2D32A6642577E33A27EB22028201D3630383B7。

site-integration-checks.json、stage7-package-checks.json位于课程根，C结果在source/验证；维护者author-tools与集成交接不放入源码包，避免包自引用。历史阶段交接保留原测试数量并导航到本页。

## 下一阶段

43—48图的方向/权重与存储、DFS/BFS、拓扑与环、Dijkstra/Bellman-Ford/Floyd、并查集/Kruskal/Prim。先约定重边/自环、顶点ID和位置、不可达/负环、距离范围与溢出、失败保证；新预算新目录，不更改前批容器/堆/排序上限。图与最终项目仍须另行实现和验收。
