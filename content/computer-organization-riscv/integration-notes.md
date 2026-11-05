# 计算机组成课程集成说明

课程ID固定为`computer-organization-riscv`，使用已有`systems`分类，无需前端、依赖、分类或构建器变更。现按用户反馈分阶段详细重写：已完成01—08章前两批，本轮完成09—12章第三批、32题与逐题答案、四项工具实验、阶段小作品和16次小课；13—32章保留首版待重写。course.json为ongoing，导览和阶段摘要明确区分新旧状态。32章是既有框架总数，不是详细版完成数量。

第一阶段验算入口为source/验证/verify-stage1.cjs，22项命名场景通过；第二阶段为source/验证/verify-stage2.cjs，26项命名场景通过，部分小位宽输入空间穷举。前两阶段主线只需纸笔，不要求新手先会Node，软件逻辑/数值结果不代表物理时序验证。第三阶段verify-stage3.cjs实际调用官方RARS v1.6，七个独立程序、40场景、27次调用通过；配Java 17.0.21+9的本课缓存仅供作者实测，不打入source/ZIP。重写标准与任务边界见AUTHORING.md，下一批为13—16章分支、循环、数组、函数与统计器。

发现工作区另有数字逻辑、操作系统课程并行写入后，本任务停止修改共享README、添加教程说明、AGENTS、site.config和tools；保留其他任务的修改。初期写入的根目录`并行编写规范.md`与本课AUTHORING提供任务模板和章节契约，现有`教程协作框架.md`及`多教程并行协作.md`可作为整站统一入口。

源文件检查：`node content/computer-organization-riscv/check-course.cjs --source-only`。

历史模型实验：`node content/computer-organization-riscv/source/示例代码/verify.cjs`，61个命名场景通过。本批新增RARS命令行实测，详见第三阶段验证记录；RARS图形单步、示例组04、Ripes、交叉编译、真机仍待执行。

统一构建后：`node content/computer-organization-riscv/check-course.cjs`检查课程发现、32章、8阶段、相对链接、搜索与学习进度隔离。源码与ZIP均在本课目录，未来只需由集成人运行一次全站build/test。网页会自动发现课程，避免硬编码课程总数。

首版任务曾完成课程级集成检查：53篇生成文档、164处本地源链接、5个搜索词和与微信课的进度隔离。其浏览器证据在reports/riscv-course.jpg；本轮详细版结果另记，避免把旧截图当成新稿验证。全站中其他课程的内容及实验状态由其各自任务负责，不在本课报告里重新认定。
