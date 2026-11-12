# Complete RARS v1.6 RV32 program. Prints 3. Timing kernel is first three instructions.
.text
.globl main
main:
    addi t0, zero, 3
    add t1, t0, t0
    sub a0, t1, t0
    addi a7, zero, 1
    ecall
    addi a7, zero, 10
    ecall
