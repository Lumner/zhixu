# 示例08：可观察RV32I子集

在本目录执行`node run.cjs`，需Node.js20或以上。完整教程见[第31章](../../31-实战可观察的RV32I子集模型.md)。从ZIP使用时保留所有相对目录，不用安装第三方包。

文件：[cpu.cjs](cpu.cjs)是解码/状态执行；[program.cjs](program.cjs)是手工编码的求和程序与数据加载；[run.cjs](run.cjs)是运行和打印追踪入口。默认结果sum=12、pointer=00000114、remaining=0，含停止标记共35步。

## 支持范围

- 运算立即数：addi、slti、sltiu、xori、ori、andi、slli、srli、srai。
- 寄存器运算：add、sub、sll、slt、sltu、xor、srl、sra、or、and。
- 加载/存储：lb、lh、lw、lbu、lhu、sb、sh、sw。
- 分支：beq、bne、blt、bge、bltu、bgeu。
- 上立即数/跳转：lui、auipc、jal、jalr。

共37种，另外把精确编码00100073的EBREAK当教学停止。其余系统指令、FENCE、ECALL、扩展编码不支持，错误会明确拒绝。没有汇编解析器：不能把`add a0,t0,t1`字符串直接交给CPU。

## 状态与边界

32个Uint32寄存器，固定有限字节内存，小端，指令4字节对齐，半字2字节对齐、word4字节对齐。模型错误不生成真实CSR或trap现场。EBREAK停止是本模型执行环境约定；真实ISA中它是断点异常。

模型允许普通内存读写含代码区域，未做ROM、页保护或特权；修改指令区会改变后续机器字。这是简化，不是安全隔离实现。

总验证入口在上层`verify.cjs`，使用已知编码、独立数学结果和非法编码负例检查。它不构成正式ISA认证，也没有模拟任何具体芯片的周期或功耗。
