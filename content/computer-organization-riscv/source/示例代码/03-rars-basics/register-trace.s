# RARS RV32, complete standalone program. No console output.
# After the first five instructions: t0=7, t1=4, a0=14, zero=0.
.text
.globl main
main:
    addi t0, zero, 3
    addi t1, zero, 4
    add t0, t0, t1
    add zero, t0, t1
    add a0, t0, t0
    addi a7, zero, 10
    ecall
