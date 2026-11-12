# Complete RARS RV32 program; expected console: 12.
# RARS executes la and environment calls outside the five-op teaching model.
.data
.align 2
values: .word 5, 0
.text
.globl main
main:
    la t0, values
    lw t1, 0(t0)
    addi t2, t1, 2
    sw t2, 4(t0)
    beq t1, t2, skip_sum
    add a0, t1, t2
skip_sum:
    li a7, 1
    ecall
    li a7, 10
    ecall
