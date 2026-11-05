# SystemVerilog详细入门：六组语言实验

这组实验对应详细重写的第07–12章，和原有15组主线示例分别管理。每个目录独立含design.sv与tb.sv，顶层均为tb；一次只编译当前实验，不把所有tb一起放进命令。

详细版第13–16章的四组新实验见[组合实验](../组合实验/README.md)。三类共25组，下面六组的源码与原验证范围保留。

| 实验目录 | 对应章节 | 目的 | 实际自动检查范围 |
| --- | --- | --- | --- |
| 07-first | 07 | 第一份设计与手写四组测试 | AND、XOR的4组输入 |
| 08-hierarchy | 08 | 同一个模块的两份实例 | 4组定向输入、左右独立接线 |
| 09-values | 09 | 常量、切片、符号扩展、四态 | 3组数据、X/Z/bit默认、未知AND |
| 10-operators | 10 | 逐位/逻辑/归约、符号与移位 | 4组定向输入、10路对照结果 |
| 11-comb | 11 | 默认赋值、清零优先与case | 全部4096组二值输入 |
| 12-majority | 12 | 独立参考模型、时间与波形 | 全部8组输入，生成VCD |

## 学习者直接运行

先完成第7章工具准备。在任一实验目录的PowerShell执行，第一条编译成功后运行第二条：

```powershell
iverilog -g2012 -s tb -o sim.vvp design.sv tb.sv
vvp sim.vvp
```

成功最后有PASS；编译错误时不继续运行旧sim.vvp。第12章会在运行目录生成majority.vcd，其他实验没有自行加入dump调用，因此不会凭空产生波形文件。

## 可选的批量脚本

在本README所在的语言实验目录，可运行：

```powershell
.\run.ps1 -Example 07-first
.\run.ps1 -Example all
```

脚本检查每次退出码，编译产物在各目录.build。可通过-Iverilog与-Vvp指定实际工具完整路径。若PowerShell执行策略不允许运行脚本，使用前面两条直接命令即可，不要求修改系统策略。

## 完整文件入口

| 目录 | 设计 | 测试 |
| --- | --- | --- |
| 07-first | [design.sv](07-first/design.sv) | [tb.sv](07-first/tb.sv) |
| 08-hierarchy | [design.sv](08-hierarchy/design.sv) | [tb.sv](08-hierarchy/tb.sv) |
| 09-values | [design.sv](09-values/design.sv) | [tb.sv](09-values/tb.sv) |
| 10-operators | [design.sv](10-operators/design.sv) | [tb.sv](10-operators/tb.sv) |
| 11-comb | [design.sv](11-comb/design.sv) | [tb.sv](11-comb/tb.sv) |
| 12-majority | [design.sv](12-majority/design.sv) | [tb.sv](12-majority/tb.sv) |

## 维护校核与验证范围

六组均已用本地Icarus11实际运行；校核还在缓存副本中注入三类错误，确认测试返回失败，并从真实VCD在八段中点读取abc、y核对。结果见[第二阶段验证记录](../验证/第二阶段详细重写验证记录.md)。GTKWave图形界面、在线仿真与板级综合不在本次实际执行范围内。

维护者可用Python3.10+运行source/验证/verify-stage2.py；它不是学习者运行实验的必要依赖。原有工程示例继续见[原示例总览](../示例代码/README.md)。
