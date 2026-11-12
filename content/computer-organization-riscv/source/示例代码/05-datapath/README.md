# 示例05：指令字段与数据通路

[datapath.s](datapath.s)保留供Ripes观察：选择实际可用的RV32单周期模型，在stop的nop前设断点，执行前3条后预期a0=7。它是片段，没有RARS退出，别越过末尾；本批没有运行Ripes。

## 本批材料与真实状态

| 文件 | 类别与使用方式 | 预期/本批状态 |
| --- | --- | --- |
| [encoding.s](encoding.s) | RV32只汇编编码清单，禁止直接Go | 已用官方RARS导出13条机器字，与第17章预期一致 |
| [sum.c](sum.c)、[sum-main.c](sum-main.c)、[sum.h](sum.h) | 两源加头文件组成完整宿主C17程序 | 已用宿主GCC 8.1.0、O0/O2构建运行，输出sum = 12 |
| [pointer-demo.c](pointer-demo.c) | 完整独立宿主C17程序 | O0/O2均已运行；三行inside = 4 / after local = 3 / after store = 9 |
| [datapath-lab.cjs](datapath-lab.cjs) | 五指令软件功能模型，无真实时钟与trap | 已运行；七步后a0=12、memory[260]=7、nextPC=32 |
| [datapath-rars.s](datapath-rars.s) | 完整RARS RV32程序 | 已用官方RARS运行；打印12，a0=12、t1=5、t2=7、内存5/7 |
| [trace.cjs](trace.cjs) | 原有37指令子集模型上的三算术指令追踪 | a0=7；含教学主机停止约定，不是架构trap |

C函数不是任意一份文件单独就能链接的完整程序；encoding和Ripes片段也不是有正常退出的独立程序。全部源码使用时保留本课示例目录相对结构，trace.cjs依赖[CPU模型](../08-mini-rv32/cpu.cjs)。

## 运行位置与命令

在**PowerShell、网站根目录**执行，Node 20以上、无第三方依赖：

```powershell
node content/computer-organization-riscv/source/示例代码/05-datapath/datapath-lab.cjs
node content/computer-organization-riscv/source/示例代码/05-datapath/trace.cjs
node content/computer-organization-riscv/source/验证/verify-stage5-models.cjs
```

本批24个模型/数值场景通过，见[模型结果](../../验证/stage5-model-checks.json)。此脚本不启动Java、编译器、浏览器或网络；不把本地编码公式说成官方汇编器本批验收。

C实操时把sum.c、sum-main.c、sum.h、pointer-demo.c复制到自己的练习目录，在**PowerShell、该目录**执行；需要已有可用GCC：

```powershell
gcc -std=c17 -Wall -Wextra -Werror -O0 sum.c sum-main.c -o sum-demo.exe
.\sum-demo.exe
gcc -std=c17 -Wall -Wextra -Werror pointer-demo.c -o pointer-demo.exe
.\pointer-demo.exe
```

本机gcc目标为x86_64-w64-mingw32，不是RV32。分阶段编译和可选RISC-V交叉路线见[第18章](../../18-C语言入门与编译链接.md)；交叉编译未执行。编码夹具与RARS完整程序的命令分别在第17/19章，不相互替代。

## 验证限制

第五批完整工具检查脚本[verify-stage5.cjs](../../验证/verify-stage5.cjs)已通过36个场景、3次RARS调用，原始命令、输出、源码校验值见[完整结果](../../验证/stage5-checks.json)。它与24场景模型脚本部分重叠，不能累加覆盖数。已完成与待执行项见[第五阶段验证记录](../../验证/第五阶段详细版验证记录.md)。

本阶段没有HDL、真实时钟、FPGA或物理频率验证。多周期控制表是纸笔调度，功能模型没有实现该状态机。回到[第17章](../../17-指令编码与机器码.md)、[第18章](../../18-C语言入门与编译链接.md)、[第19章](../../19-单周期CPU数据通路.md)或[第20章](../../20-控制器与多周期CPU.md)。
