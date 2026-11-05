# RARS RV32. Chapter 12 independent practice reference solution.
# Inputs are three adjacent words. Expected console: 13.
# out = (x + y) - z = (12 + -5) - -6 = 13.
.data
.align 2
x: .word 12
y: .word -5
z: .word -6
out: .word 0
.text
.globl main
main:
    la t0, x
    lw t1, 0(t0)
    lw t2, 4(t0)
    lw t3, 8(t0)
    add t4, t1, t2
    sub t4, t4, t3
    sw t4, 12(t0)
    lw a0, 12(t0)
    li a7, 1
    ecall
    li a7, 10
    ecall
