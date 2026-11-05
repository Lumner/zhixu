# 示例03：RARS首次运行、指令与内存

环境：RARS v1.6、RV32、Default内存配置、允许伪指令、小端。每个.s文件都是完整独立程序，均不需要交互输入。一次只打开并汇编一个，不启用目录整体汇编；这些文件各有main，不能直接拼接。

安装、PowerShell目录与完整Java路径写法见[第09章](../../09-RISC-V工具与第一个程序.md)。不用先会Java编程，不必先装Node，也不需要开发板。以下是本批实际运行的七个程序：

| 文件 | 对应正文 | 运行后观察 | 预期 |
| --- | --- | --- | --- |
| [hello.s](hello.s) | 第09章 | 控制台、a0 | 输出7，a0=7 |
| [register-trace.s](register-trace.s) | 第10章 | t0/t1/a0/zero | 7、4、14、0；无打印 |
| [arithmetic.s](arithmetic.s) | 第11章 | 运算结果表 | 右移7FFFFFFC/FFFFFFFC；比较1/0；t6=13；a4/a5/s3=12345ABC；无打印 |
| [pseudo.s](pseudo.s) | 第11章 | Basic列、最终寄存器 | 9条执行性源语句展开11条；t0=7，t1=2048，t2=t3=12345ABC，t4=0；无打印 |
| [memory.s](memory.s) | 第12章 | copy、t1/t3/t5/t6 | copy=t1=12345678，t3=78，t5=FFFFFFFE，t6=FE；无打印 |
| [memory-update.s](memory-update.s) | 第12章 | 内存、扩展结果、控制台 | result=5；t1=112233AA；s4与patch=1122BBCC；a1— a4为CC/BB/22/11；输出5 |
| [stage3-practice.s](stage3-practice.s) | 阶段小作品 | out、控制台、输入 | out=13、输出13，三个输入保留 |

表中大写十六进制按32位理解，省略前导0的字节结果仍位于32位寄存器；例如t6=FE在memory.s中表示000000FE，不是FFFFFFFE。arithmetic和memory-update的完整寄存器表分别在[第11章](../../11-整数运算立即数与伪指令.md)与[第12章](../../12-加载存储与内存实验.md)。

## 图形界面运行

在RARS打开单个文件，保存、Assemble、从新初态Step或Go。无打印的程序按寄存器和内存验收，不要把空控制台当成失败。断点暂停在目标指令执行前；修改源码后重新汇编。

RARS数据区常按word显示。要看各字节，可以像memory-update.s一样用四条lbu读取，不要求工具一定提供独立byte视图。Default数据基址是本例使用的10010000，实际地址还应按标签与机器表核对。

## 命令行运行

将本目录要练的文件复制到自己的练习目录，例如C:\riscv-study，并把rars1_6.jar放在那里。在**PowerShell、该练习目录**执行下方命令；已有Java可通过java命令调用：

```powershell
java -jar .\rars1_6.jar nc sm .\hello.s
java -jar .\rars1_6.jar nc sm t0 t1 a0 zero .\register-trace.s
java -jar .\rars1_6.jar nc sm t1 s4 0x10010000-0x1001000c .\memory-update.s
```

nc隐藏横幅，sm从全局main开始；未加rv64时使用RV32。后两行让RARS运行结束后列出选定寄存器或内存。服务10可能另有正常退出消息，程序自身没有自动补换行。

只汇编并导出伪指令机器表，在**同一终端、同一目录**执行：

```powershell
java -jar .\rars1_6.jar nc a dump .text SegmentWindow .\pseudo-text.txt .\pseudo.s
Get-Content .\pseudo-text.txt
```

这不会执行程序。RARS 1.6实测mv展开为add rd,zero,rs，效果等价于addi rd,rs,0；li 2048与li 12345ABC各两条，其他本例形式各一条。界面的负立即数可能用符号扩展后的十六进制显示。

## 实际验证与范围

2026-11-05用官方RARS v1.6 JAR、Temurin Java 17.0.21+9，在Windows命令行完成七个独立程序、改造输入、前缀步数、伪指令导出及预期错误检查，共40个命名场景、27次RARS调用。证据与命令见[第三阶段详细版验证记录](../../验证/第三阶段详细版验证记录.md)，真实机器表见[导出文本](../../验证/stage3-pseudo-text.txt)。

该结果不是图形界面逐项操作、Ripes、完整ISA符合性或真机验证。Node教学CPU模型不接受这些.s文件与RARS服务。其他示例组的运行状态由各自README记录，不能因本组通过就认定后续循环/函数程序也已执行。
