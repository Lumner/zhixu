# 计算机组成课程集成说明

课程ID固定为`computer-organization-riscv`，使用已有systems分类，不改前端、依赖或构建器。2026-11-10本轮完成21—24章第六批详细正文、44题解析、四实验与22次小课，累计01—24章；25—32章首版待重写。course.json保持ongoing。第六批完整检查69项、20次RARS调用；模型模式49项包含在内，不累加。

第一/二阶段模型22/26场景，第三阶段RARS七程序/40场景，第四阶段RARS九程序/58场景，第五阶段完整36场景/3次RARS调用均有原报告。第六批source/验证/verify-stage6.cjs已完成13组机器码官方核对、五个完整RARS程序共7次执行，以及流水/预测模型；200份生成算术程序在两种转发模式下共400次对照。文档与首次实验在11月5日准备，11月10日补齐边界检查后完整复核。交叉编译、GUI、HDL与真机仍未执行。Java/JAR/临时产物只在.cache，不打包。下一批为25—28章存储与I/O。

发现工作区另有数字逻辑、操作系统课程并行写入后，本任务停止修改共享README、添加教程说明、AGENTS、site.config和tools；保留其他任务的修改。初期写入的根目录`并行编写规范.md`与本课AUTHORING提供任务模板和章节契约，现有`教程协作框架.md`及`多教程并行协作.md`可作为整站统一入口。

源文件检查：`node content/computer-organization-riscv/check-course.cjs --source-only`。

历史模型实验：`node content/computer-organization-riscv/source/示例代码/verify.cjs`，61个命名场景通过。RARS命令行实测分别见第三/第四阶段记录；RARS图形单步、Ripes、交叉编译、真机仍待执行。额外非零计数等扩展题没有纳入九个已运行基线程序。

统一构建后：`node content/computer-organization-riscv/check-course.cjs`检查课程发现、32章、8阶段、相对链接、搜索与学习进度隔离。源码与ZIP均在本课目录，未来只需由集成人运行一次全站build/test。网页会自动发现课程，避免硬编码课程总数。

首版任务曾完成课程级集成检查：53篇生成文档、164处本地源链接、5个搜索词和与微信课的进度隔离。其浏览器证据在reports/riscv-course.jpg；本轮详细版结果另记，避免把旧截图当成新稿验证。全站中其他课程的内容及实验状态由其各自任务负责，不在本课报告里重新认定。
