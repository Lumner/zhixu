# RARS v1.6 RV32. Compare Source and Basic columns.
# No console output. t0=7, t1=2048, t2=t3=0x12345abc, t4=0.
.text
.globl main
main:
    li t0, 7
    li t1, 2048
    li t2, 0x12345abc
    mv t3, t2
    nop
    not t4, zero
    addi t4, t4, 1
    li a7, 10
    ecall
