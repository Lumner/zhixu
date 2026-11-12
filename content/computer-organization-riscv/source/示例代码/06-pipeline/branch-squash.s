# Complete RARS v1.6 RV32 program. Prints 123; value must remain 123.
.data
.align 2
value: .word 123
.text
.globl main
main:
    lui t0, 0x10010
    addi t1, zero, 1
    beq t1, t1, taken
    sw zero, 0(t0)
    addi a0, zero, 99
taken:
    lw a0, 0(t0)
    addi a7, zero, 1
    ecall
    addi a7, zero, 10
    ecall
