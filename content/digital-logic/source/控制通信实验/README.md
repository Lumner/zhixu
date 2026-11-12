# 控制与通信详细版：四组独立实验

对应详细版第22–25章。每个目录含design.sv与tb.sv，顶层为tb；一次只编译当前目录的两文件。原15组工程、6组语言、4组组合、5组时序与本组4个实验分别保留，共34组，不覆盖旧接口。

| 目录 | 内容 | 实际检查范围 |
| --- | --- | --- |
| 22-fsm | 三状态红绿黄控制器、枚举、Moore输出 | 10脚本沿、6行正常表、沿间保持和复位优先 |
| 23-ready-valid | 一项缓冲、背压、同沿替换 | 13周期，5输入/4输出/1复位丢弃，队列与保持检查 |
| 24-fifo | 四项单时钟FIFO、同步读、沿前空满 | 220周期，回绕、边界拒绝、同进同出、复位与数量核对 |
| 25-uart | 锁存帧、8N1、每位拍数、忙时拒绝 | CPB1/4各256完整帧，共5120位中心；另两次中止 |

## 1. 学习者直接运行

完成[第7章](../07-环境与第一个仿真实验.md)工具准备，在任一实验目录的PowerShell逐条执行：

```powershell
iverilog -g2012 -s tb -o sim.vvp design.sv tb.sv
vvp sim.vvp
```

先编译成功，再运行。修改后保存并重编译，避免执行旧sim.vvp。第25组使用两份检查模块，等待两配置都完成后统一结束，并在当前目录生成uart.vcd。

## 2. 完整文件入口

| 目录 | 设计 | 测试 |
| --- | --- | --- |
| 22-fsm | [design.sv](22-fsm/design.sv) | [tb.sv](22-fsm/tb.sv) |
| 23-ready-valid | [design.sv](23-ready-valid/design.sv) | [tb.sv](23-ready-valid/tb.sv) |
| 24-fifo | [design.sv](24-fifo/design.sv) | [tb.sv](24-fifo/tb.sv) |
| 25-uart | [design.sv](25-uart/design.sv) | [tb.sv](25-uart/tb.sv) |

## 3. 实际执行与复现

四组均使用Icarus11实际编译运行。九个错误副本均编译成功后被仿真检查拒绝；实际UART VCD另解码八帧80中心，确认两种每位拍数下的00/53/A5/FF。见[第五阶段记录](../验证/第五阶段详细重写验证记录.md)与[JSON](../验证/第五阶段仿真结果.json)。

可选[维护脚本verify-stage5.py](../验证/verify-stage5.py)使用Python3.10+标准库，在网站根目录PowerShell运行：

```powershell
python content/digital-logic/source/验证/verify-stage5.py
```

要求iverilog/vvp在PATH，也可通过--iverilog与--vvp传实际完整路径。脚本将产物、错误副本与VCD写入.cache/digital-logic-stage5，更新本课程JSON。单独学习本组实验不要求先学Python或修改PowerShell系统执行策略。

有限时序不是全部输入历史穷举；UART内容遍历全部256值，但参数仅1、4。本批未执行GUI、综合、时序、真实串口或上板，也没有交付FIFO连接UART的完整适配器。此前实验见[时序](../时序实验/README.md)、[组合](../组合实验/README.md)、[语言](../语言实验/README.md)与[原工程](../示例代码/README.md)。
