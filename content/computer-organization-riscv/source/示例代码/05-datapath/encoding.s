# RARS v1.6 RV32 ASSEMBLE-ONLY fixture. Do not Go/run this instruction list.
# Operand values and addresses are not initialized for execution.
.text
.globl main
main:
    addi x5, x0, 7
    add x7, x5, x6
    sub x7, x5, x6
    addi x5, x5, -1
    lw x7, 4(x5)
    sw x6, -4(x5)
backward:
    beq x0, x0, forward
    addi x0, x0, 0
forward:
    beq x0, x0, backward
    lui x5, 0x12345
    jal x1, jump_target
    addi x0, x0, 0
jump_target:
    addi x0, x0, 0
