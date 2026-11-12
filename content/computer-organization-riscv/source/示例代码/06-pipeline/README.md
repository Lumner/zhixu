# 示例06：性能、流水线与预测实验

对应第21—24章详细版。纸笔为主线，Node与官方RARS分别核对本课时序、架构结果；Ripes为另外的可选GUI观察。先读[五级模型约定](../../22-五级流水线.md)，不要把某个模拟器耗时换算成真实CPU频率。

## 完整程序、模型与片段

| 文件 | 类别/平台 | 实际结果或用途 |
| --- | --- | --- |
| [count-loop.s](count-loop.s) | 完整RARS v1.6 RV32程序 | N=0/1/5打印0/0/10；区域IC为4/8/24，工具ic为7/11/27 |
| [alu-chain.s](alu-chain.s) | 完整RARS RV32程序 | 打印3；前3条用于ALU相关分析 |
| [load-use.s](load-use.s) | 完整RARS RV32程序 | 打印7、t2=14、t5=1 |
| [scheduled.s](scheduled.s) | 完整RARS RV32程序 | 同上；独立递增移到load-use间隔中 |
| [branch-squash.s](branch-squash.s) | 完整RARS RV32程序 | 打印123、内存word仍123；跳过错误路径store |
| [pipeline-lab.cjs](pipeline-lab.cjs) | Node离散周期模型 | 13个内置序列；支持add/sub/addi/lw/sw/beq/bne |
| [predictor-lab.cjs](predictor-lab.cjs) | 独立方向计数器 | 初始01，T,T,N,T错2次；未接入CPU或BTB |
| [hazards.s](hazards.s) | 原有Ripes RV32片段 | la、lw、add、sub；stop处断点，预期t1=7、t2=14、t3=7；本批GUI未运行 |

前五个完整文件有打印与正常RARS退出；它们不依赖彼此，分别打开运行。load-use/scheduled依赖本例RARS重置后的t5初值0；修改寄存器初态时先记录，再预测结果。hazards.s没有正常退出，不要直接越过末尾；其la需要核对实际展开。

## 平台、目录与命令

已有Node.js 20以上，在**Windows PowerShell、网站根目录**执行，无第三方依赖：

```powershell
node content/computer-organization-riscv/source/示例代码/06-pipeline/pipeline-lab.cjs independent
node content/computer-organization-riscv/source/示例代码/06-pipeline/pipeline-lab.cjs alu no-forward
node content/computer-organization-riscv/source/示例代码/06-pipeline/pipeline-lab.cjs load
node content/computer-organization-riscv/source/示例代码/06-pipeline/pipeline-lab.cjs unscheduled
node content/computer-organization-riscv/source/示例代码/06-pipeline/pipeline-lab.cjs scheduled
node content/computer-organization-riscv/source/示例代码/06-pipeline/pipeline-lab.cjs taken
node content/computer-organization-riscv/source/示例代码/06-pipeline/predictor-lab.cjs 'T,T,N,T'
```

pipeline摘要列cycles总周期、retired有效完成数、stalls额外数据等待、redirects下一PC纠正次数。表格槽位填指令地址的十进制值，null表示空槽。预测器表列before旧状态、guess预测、actual实际、miss对错、after更新状态，必须先预测后更新。

把某个完整.s文件与已有RARS JAR放在自己的练习目录，在**PowerShell、该目录**执行，例如：

```powershell
java -jar .\rars1_6.jar nc me sm ic a0 .\count-loop.s
java -jar .\rars1_6.jar nc me sm a0 t2 t5 .\load-use.s
java -jar .\rars1_6.jar nc me sm a0 t2 t5 .\scheduled.s
java -jar .\rars1_6.jar nc me sm a0 0x10010000-0x10010000 .\branch-squash.s
```

准备Java与RARS见[第09章](../../09-RISC-V工具与第一个程序.md)。nc隐藏启动版权消息，me把工具消息/寄存器报告送到标准错误，sm从main开始。两股输出都应保留；打印结果不能替代寄存器/内存检查。

## 时序假设和停止边界

模型为单发射顺序五级，指令/数据路径独立，固定一周期数据内存；WB先写ID后读；ALU结果EX末、load内容MEM末；操作数与store数据在EX使用；无晚MEM到MEM转发。分支EX末判定，预测顺序，错误时清前端年轻指令。

关转发时保留冒险检测，结果应不变，等待可能增加。模型有转发结果：independent7周期、alu7、load8、unscheduled10、scheduled9、taken10；alu无转发11。模型代码/data采用低地址0/256，完整RARS文件使用默认代码/数据布局；不能把模型低地址load直接复制到RARS当成有正确数据的程序。

有限清单用尽后排空是主机实验约定，不是架构退出；无ecall、CSR、精确异常、自修改代码、Cache或物理门延迟。独立预测器也不是完整分支预测硬件。

## 真实验证和可复现记录

[verify-stage6.cjs](../../验证/verify-stage6.cjs)模型模式49项通过；加官方工具参数的完整模式69项通过，包含20次RARS调用：13次只汇编、五个完整程序共7次执行。两种报告包含重叠项，不相加；200份生成算术程序在两种转发模式下共400次对照也单独报告。

模型结果见[stage6-model-checks.json](../../验证/stage6-model-checks.json)，完整命令/输出与源码SHA-256见[stage6-checks.json](../../验证/stage6-checks.json)，解释与限制见[第六阶段详细版验证记录](../../验证/第六阶段详细版验证记录.md)。未实测Ripes GUI、HDL、FPGA、真实芯片，未把它们记作通过。

回到[第21章](../../21-性能指标与加速比.md)、[第22章](../../22-五级流水线.md)、[第23章](../../23-数据冒险转发与停顿.md)、[第24章](../../24-控制冒险与分支预测.md)，或按[学习记录](../../第六阶段-学习记录与验收清单.md)安排四项实验。
