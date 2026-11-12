# 时序与存储详细版：五组独立实验

对应详细版第17–21章。每个目录独立含design.sv与tb.sv，顶层均为tb；21-memory另带必需的rom.hex。连同原15组、6组语言、4组组合以及后续[4组控制通信](../控制通信实验/README.md)，共34组，不用新程序覆盖旧接口。

| 目录 | 学习重点 | 实际检查范围 |
| --- | --- | --- |
| 17-pipeline | 两级旧值/新值、非阻塞、沿间保持 | 七个脚本沿、一次保持；生成pipeline.vcd |
| 18-reset | 同步/异步、高有效、清零/使能优先级 | 17个脚本沿，短复位/释放/保持三项 |
| 19-tick | 沿前终值使能、消费者、参数、暂停 | DIV=1/4/5，每配置25周期 |
| 20-shift-pwm | 四位移位、8格PWM、饱和、实时duty | 五项移位，16帧128相位，两次实时改变 |
| 21-memory | 数组、ROM文件、同步read-first RAM | 14次访问、四项ROM、X、写禁止与沿间保持 |

## 1. 直接运行

先按[第7章](../07-环境与第一个仿真实验.md)准备Icarus。在当前实验目录的PowerShell执行，第一条成功才运行第二条：

```powershell
iverilog -g2012 -s tb -o sim.vvp design.sv tb.sv
vvp sim.vvp
```

修改后保存并重新编译；不要继续运行上次旧产物。21-memory从自己的目录运行，让$readmemh找到rom.hex；它是数据文件，不作为HDL源传给编译器。不需要修改系统执行策略。

## 2. 完整文件

| 目录 | 设计 | 测试 | 其他附件 |
| --- | --- | --- | --- |
| 17-pipeline | [design.sv](17-pipeline/design.sv) | [tb.sv](17-pipeline/tb.sv) | 运行生成pipeline.vcd |
| 18-reset | [design.sv](18-reset/design.sv) | [tb.sv](18-reset/tb.sv) | 无 |
| 19-tick | [design.sv](19-tick/design.sv) | [tb.sv](19-tick/tb.sv) | 三种参数同一测试 |
| 20-shift-pwm | [design.sv](20-shift-pwm/design.sv) | [tb.sv](20-shift-pwm/tb.sv) | 无 |
| 21-memory | [design.sv](21-memory/design.sv) | [tb.sv](21-memory/tb.sv) | 必需[rom.hex](21-memory/rom.hex) |

## 3. 实际结果与维护复现

五组均已使用Icarus11实际编译运行。九个错误副本都编译成功后被仿真检查拒绝；从真实pipeline.vcd解析了七组沿后样本。详见[第四阶段记录](../验证/第四阶段详细重写验证记录.md)与[原始JSON](../验证/第四阶段仿真结果.json)。

可选维护脚本[verify-stage4.py](../验证/verify-stage4.py)使用Python3.10+标准库，在网站根目录PowerShell运行：

```powershell
python content/digital-logic/source/验证/verify-stage4.py
```

要求iverilog/vvp可从PATH调用；也可通过--iverilog与--vvp传实际完整路径。它将产物、ROM附件副本、错误副本写入.cache/digital-logic-stage4，并更新本课程JSON。该脚本是维护工具，学习者只运行单例时不需要先学Python。

本批只检查列出的有限时序与参数，不是所有输入历史的穷举。未执行GTKWave GUI、器件综合、静态时序或上板。此前实验分别见[组合实验](../组合实验/README.md)、[语言实验](../语言实验/README.md)、[原工程示例](../示例代码/README.md)。
