# RARS RV32, nested call, 16-byte-aligned stack. Expected: 11
.text
.globl main
main:
    andi sp, sp, -16
    li a0, 5
    jal ra, double_plus_one
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
    add a0, a0, a0
    ret
