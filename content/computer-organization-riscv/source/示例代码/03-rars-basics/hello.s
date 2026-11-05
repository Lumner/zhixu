# RARS RV32, complete program. Expected console: 7
.text
.globl main
main:
    li t0, 3
    li t1, 4
    add a0, t0, t1
    li a7, 1
    ecall
    li a7, 10
    ecall
