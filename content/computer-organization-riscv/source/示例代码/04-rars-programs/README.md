# 示例04：分支、循环、字符串、函数与统计器

所有九个.s文件均为互相独立的完整程序，环境为RARS v1.6、RV32、Default、小端、允许伪指令，无键盘输入。一次只汇编一个，不启用目录项目模式；使用RARS打印/退出服务，不能直接在教学Node模型中载入.s文本。

| 文件 | 输入/行为 | 预期输出 |
| --- | --- | --- |
| [branch-demo.s](branch-demo.s) | 把有符号输入−3截到至少0 | 0；改输入0/5时输出0/5 |
| [range-sum.s](range-sum.s) | 1到N，默认N=5 | 15 |
| [sum.s](sum.s) | 数组3,-2,7,0,4求和 | 12 |
| [sum-index.s](sum-index.s) | 同一数组，下标乘4计算字节地址 | 12 |
| [strlen.s](strlen.s) | ASCII RISC-V字节长度 | 6 |
| [bounded-strlen.s](bounded-strlen.s) | ABC三字节无结束0，容量3 | 两行3、0；长度与找到结束0标志 |
| [functions.s](functions.s) | 输入5，嵌套调用算2x+1 | 11 |
| [abi-lab.s](abi-lab.s) | 保护调用者旧t0=90，callee故意改t0 | 101；t0=90、s0=123、sp=s1 |
| [stats.s](stats.s) | 求和、最大值、正数数 | 三行12、7、3 |

统计器长度<=0时不读输入，输出0、empty、0；全负[-5,-2]输出−7、−2、0。改数组时同步修改main中的长度；不要令长度超过实际数据。sum.s的简单顶部循环要求非负长度且不超过实际项数，不把统计器的负长度保护承诺推广给它。

functions、abi-lab、stats在独立main先把RARS初始sp向下对齐16字节；普通函数保持相应ABI承诺。不要把入口对齐操作复制到已有栈帧中。stats的四寄存器返回为自定义教学接口，不是任意C返回类型的通用ABI。

## 怎样运行

工具准备见[第09章](../../09-RISC-V工具与第一个程序.md)。把要练的.s和rars1_6.jar放进自己的练习目录，在**PowerShell、该目录**执行；以下命令各自启动一次独立程序：

```powershell
java -jar .\rars1_6.jar nc sm .\range-sum.s
java -jar .\rars1_6.jar nc sm .\sum.s
java -jar .\rars1_6.jar nc sm t2 t3 .\bounded-strlen.s
java -jar .\rars1_6.jar nc sm a0 t0 s0 s1 sp .\abi-lab.s
java -jar .\rars1_6.jar nc sm s0 s1 s2 s3 .\stats.s
```

nc隐藏横幅，sm从全局main开始。需要完整Java路径时按第09章的PowerShell & 写法替换java命令。程序可能另有正常退出消息；无显式换行的程序不应凭换行样式判错。

图形界面按各章的保存、Assemble、Reset、断点和单步操作；每次改输入都重新汇编。统计器最终a0被展示重用，核对s0—s3；有界扫描核对t2/t3，不能把最后打印换行的a0=10当作算法结果。

## 实际验证与边界

2026-11-05用官方RARS v1.6 JAR与Temurin Java 17.0.21+9，在Windows命令行通过58个命名检查场景、57次RARS调用，覆盖本组九个程序、边界输入、保存现场和九种故障。旧五程序现已实测，本批另新增四程序；不是把五个首版文件简单改名后当成新交付。

命令、输出、源指纹与限制见[第四阶段验证记录](../../验证/第四阶段详细版验证记录.md)，机器表见[functions实际导出](../../验证/stage4-functions-text.txt)。源码中的非零计数等独立扩展题未当成已完成程序。本批未实际操作RARS GUI、Ripes或真机，功能步骤与程序输出也不是芯片周期数据。

回到[第13章](../../13-条件分支与循环.md)、[第14章](../../14-数组指针与字符串.md)、[第15章](../../15-函数调用栈与ABI.md)或[第16章](../../16-实战整数统计器.md)，配合[学习记录](../../第四阶段-学习记录与验收清单.md)和[36题](../../第四阶段-练习与参考答案.md)。
