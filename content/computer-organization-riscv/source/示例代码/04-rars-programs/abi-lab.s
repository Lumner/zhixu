# RARS RV32, complete standalone program. Expected console: 101.
# Caller protects live t0=90; callee intentionally clobbers t0.
# s0=123 survives nested calls, and sp returns to the aligned entry value.
.text
.globl main
main:
    andi sp, sp, -16
    mv s1, sp
    li s0, 123
    li t0, 90
    addi sp, sp, -16
    sw t0, 0(sp)
    li a0, 5
    jal ra, double_plus_one
    lw t0, 0(sp)
    addi sp, sp, 16
    add a0, a0, t0
    li a7, 1
    ecall
    li a7, 10
    ecall
double_plus_one:
    addi sp, sp, -16
    sw ra, 12(sp)
    sw s0, 8(sp)
    mv s0, a0
    mv a0, s0
    jal ra, twice
    addi a0, a0, 1
    lw s0, 8(sp)
    lw ra, 12(sp)
    addi sp, sp, 16
    ret
twice:
    li t0, -99
    add a0, a0, a0
    ret
