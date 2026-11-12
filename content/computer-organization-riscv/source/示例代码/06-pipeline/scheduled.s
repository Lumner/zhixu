# Complete RARS v1.6 RV32 program. Same registers/memory as load-use.s.
# Moving an independent increment fills the model's load-use gap.
.data
.align 2
value: .word 7
.text
.globl main
main:
    lui t0, 0x10010
    lw t1, 0(t0)
    addi t5, t5, 1
    add t2, t1, t1
    sub a0, t2, t1
    addi a7, zero, 1
    ecall
    addi a7, zero, 10
    ecall
