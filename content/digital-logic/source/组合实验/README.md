# 组合电路详细版：四组独立实验

对应详细版第13–16章。每个目录含design.sv与tb.sv，顶层都叫tb；一次只编译当前实验目录的两文件。连同原15组、6组语言、后续[5组时序](../时序实验/README.md)和[4组控制通信](../控制通信实验/README.md)，共34组；新接口不覆盖旧程序。

| 目录 | 学习目的 | 实际检查范围 |
| --- | --- | --- |
| 13-routing | 四选一、使能译码、最高编号优先编码 | 16组数据图样×4选择×2使能×16请求=2048组；不是全数据空间穷举 |
| 14-alu | 四位加减、与/异或、C/V/Z | 9组手算定向测试 |
| 15-parameter | 参数、localparam、函数、generate与边界 | WIDTH=1/4/7、DEPTH=1/5/8；16644组数据、18项地址、16组BCD |
| 16-alu-regression | 扩展OR、保留码、独立整数模型、故障定位 | 全部2048组二值输入、全部输出、生成alu.vcd |

## 1. 学习者运行

先按[第7章](../07-环境与第一个仿真实验.md)准备Icarus。在任一实验目录的PowerShell，逐条执行：

```powershell
iverilog -g2012 -s tb -o sim.vvp design.sv tb.sv
vvp sim.vvp
```

第一条编译成功，才运行第二条；修改并保存代码后必须重新编译。相对路径从当前目录解释，用Get-Location和Get-ChildItem确认没有走错目录。本组没有要求修改系统执行策略或安装额外Python依赖。

成功最终含PASS。第16组还生成alu.vcd，位置是运行时当前目录。它用三位op和valid_op；第14组是两位op的四操作版本，两者测试文件不能不加检查直接互换。

## 2. 完整文件入口

| 实验 | 设计 | 测试 |
| --- | --- | --- |
| 13-routing | [design.sv](13-routing/design.sv) | [tb.sv](13-routing/tb.sv) |
| 14-alu | [design.sv](14-alu/design.sv) | [tb.sv](14-alu/tb.sv) |
| 15-parameter | [design.sv](15-parameter/design.sv) | [tb.sv](15-parameter/tb.sv) |
| 16-alu-regression | [design.sv](16-alu-regression/design.sv) | [tb.sv](16-alu-regression/tb.sv) |

## 3. 故障与维护记录

四组均已用Icarus11实际编译运行。维护验证在缓存副本中注入七种错误，全部在编译成功后被仿真检查拒绝；还解析真实ALU波形八组样本。详见[第三阶段验证记录](../验证/第三阶段详细重写验证记录.md)与[JSON](../验证/第三阶段仿真结果.json)。

可选维护脚本[verify-stage3.py](../验证/verify-stage3.py)使用Python3.10+标准库，在网站根目录PowerShell可执行：

```powershell
python content/digital-logic/source/验证/verify-stage3.py
```

脚本要求iverilog/vvp已在PATH，也可用--iverilog与--vvp提供实际完整路径；示例`python ... --iverilog "实际路径/iverilog.exe" --vvp "实际路径/vvp.exe"`中的路径必须替换。它把编译产物、错误副本和VCD写到网站根目录.cache/digital-logic-stage3，更新课程目录内的JSON记录；不是学生运行单个实验的必要步骤。

本批不包含FPGA综合、器件时序与上板。四态输入未作全空间检查；参数检查只对应列出的三种配置。更早实验见[语言实验](../语言实验/README.md)和[原工程示例](../示例代码/README.md)。
