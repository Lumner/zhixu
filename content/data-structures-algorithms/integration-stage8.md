> 52章与最终v1.0已交付，最新验证见 [完整主线交接](integration-stage9b.md)。本页保留历史批次范围。

> 最新51章累计交付见 [第九阶段上交接](integration-stage9a.md)。本页保留历史批次验证范围。

# 第八阶段交接：图、依赖与路线

日期2026-11-12。本批仅维护content/data-structures-algorithms；未修改其他课程、共享web/tools、依赖或根说明，dist由串行构建生成。未启动其他作者。

## 真实完成范围

新增43—48六章详细正文：图与两种存储、DFS/BFS、拓扑与依赖环、Dijkstra与路径恢复、Bellman–Ford/Floyd与负环影响、并查集与最小生成森林。每章包含目标/先修、术语解释、手推/不变量、完整核心C、终端目录与编译命令、结果原因、常见错误、练习答案与完成条件。

另有第八阶段独立练习、独立答案、25份新例程C/H与完整源码附录、公共构建表、固定图关系实验台、来源核验、三份C参考模型、Python执行器及真实检查结果。八组程序为存储、遍历、拓扑、Dijkstra、Bellman、Floyd、森林、关系实验台；共享模块与验证器不重复计数。

累计48章正文、56组完整程序、8个已交付阶段，course.json保持ongoing与原有systems分类，新增稳定分组graph-algorithms覆盖43—48。52章/9阶段框架保持；49—52仅规划。第八阶段48—67小时（含练习10—14），前八290—411，全课当前308—439小时，含手打与排错。

## 关键实现约定

Graph最多8点，位置0..n-1，权重-1000..1000；has与weight分开，零权有效。允许自环、拒绝重边，无向反向为同边。无向非自环两弧、自环一弧；数学度数另说明。对象只含值数组，可按值复制，不申请动态内存。输出对象独立，错误保留旧值；输入由API保持不变量。

DFS/BFS从单源开始，BFS入队前标记；分量只支持无向。Kahn初始与邻居升序、FIFO，不承诺字典序最小；G_CYCLE时不交付部分顺序，不输出具体环。矩阵遍历/拓扑按V²计。

距离分FINITE/UNREACHABLE/NEGATIVE，仅FINITE数值有效；Dijkstra拒绝全图任意负边，矩阵V²。Bellman采用轮次快照，传播可达负环影响；Floyd采用逐中间点快照，按源→负环→目标标记，二者矩阵V³。相加前检查long边界；8点/千权快照预算有明确界，不实际执行整数溢出。Floyd未提供路径矩阵。

DSU路径压缩、按大小合并，merged区分成功合并与原本同组。Kruskal收集u<v边、按完整Edge排序，计矩阵收边；Prim逐分量启动。二者忽略自环、允许负边、拒绝有向，返回森林V-C条边，不要求同权时边集一致。

关系网络v0.8a仅固定先修图与非负路线CLI；没有资料目录/分类树、业务ID映射、图文件、最终菜单或v1.0整合。旧目录v0.3与全部旧版保留。

## 实际运行与结果

PowerShell、网站根目录执行：

```powershell
python content/data-structures-algorithms/source/验证/verify-stage8.py --cc D:\mingw\mingw64\bin\gcc.exe
npm run build
npm test
node content/data-structures-algorithms/source/验证/check-site.cjs
```

单课正式检查995项通过，runtimeOnly=false，八组实际编译运行。已有MinGW-w64 GCC8.1.0，C17/Wall/Wextra/Wpedantic/Werror/O0及旧stdio ANSI兼容选项；未新装MSYS2。完整记录和逐项结果在source/验证。

存储5,000步模型；512张有向图逐源遍历、64张无向图分量；65,536张有向图以枚举排列核对拓扑；DSU10,000步标签模型。262,144张三点加权有向图，以独立简单路径/简单负环枚举核对有限距离、可达、负环影响及恢复路径。4,096张无向图枚举候选边子集求最优森林，检查两种算法；另有8点最大容量、负权链、全负图、孤立点、空图、零权、自环、非法参数、输出保持与安全加法边界。

五个安全逻辑错误变体均被独立参考拒绝：拓扑接受部分、Dijkstra忽略零权、负环只传播一轮、Floyd漏上游影响、Prim忽略其他分量。没有动态内存申请，不虚构malloc失败注入；没有运行越界、坏指针或溢出行为。

最终串行构建：5课程、184主线章、431文档、3069原始附件、29图，失效Markdown链接0。npm test通过887项、1798本地文档/附件链接。本课网页数据121项通过，含48连续ID、8组/56程序、搜索、正文目录/高亮、进度隔离；第45章依赖图与第37章树图均断言实际生成SVG。构建后发现示例索引旧总数，修正为56并重新打包/构建，以上网页结果来自最终版本。

## 下载包与保留检查

downloads/data-structures-algorithms-stage8.zip包含全部source及AUTHORING.md，273条、561563字节。CRC与逐文件字节核对通过，无exe/o/tmp/pyc。SHA256：1C4604685B0F9CBD43AC18F3FB0DD7234DC4F2A34CE75FDEC54CA965AF4B372B。

对照stage7包的129份原有C/H逐字节不变；stage7历史包SHA256仍为6EC39AD2245AC1D2F92DF7028C2D32A6642577E33A27EB22028201D3630383B7。其余历史包只读保留。课程完整内容、结果与包准备好后才注册48章及stage8下载入口。

stage8-package-checks.json与site-integration-checks.json位于课程根；author-tools、历史交接与本集成记录不进入源码包，避免包自引用。

## 限制与下一批

尝试使用现有Windows界面技能查看本地页面时，Computer Use报告无法可靠确定当前浏览器URL，因策略检查停止。本批立即停止所有界面操作，没有绕过限制。浏览器视觉、窄屏、file://与复制未验收，browserQA=false；SVG/网页数据检查不等于视觉验收。

未实测Linux/macOS/ARM、ASan/Valgrind、实际业务图文件、性能基准、并发或最终工程整合。有限小图穷举不是全部8点输入空间的穷尽证明。无共享框架改动，未额外运行test:extension。

下一批49—52可拆成49—51算法设计和52综合工程：贪心与反例/交换论证、回溯与撤销/剪枝、动态规划与状态/转移/边界/恢复，最后明确ID映射、文件协议、所有权、容量、失败保证后整合最终学习资料检索与路线规划器。保持旧版，不能把任务书或独立例程统计为最终成品。
