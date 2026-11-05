# RARS RV32, complete standalone program. No console output.
# Observe register results listed in README and chapter 11.
.text
.globl main
main:
    li t0, -8
    srli t1, t0, 1
    srai t2, t0, 1
    li t3, -1
    li t4, 1
    slt s0, t3, t4
    sltu s1, t3, t4
    li t5, 45
    andi t6, t5, 15
    slli a1, t5, 2
    addi a2, zero, -2048
    addi a3, zero, 2047
    li a4, 0x12345abc
    mv a5, a4
    not a6, t3
    lui s3, 0x12346
    addi s3, s3, -1348
    li s4, 0x7fffffff
    addi s5, s4, 1
    li s7, 33
    sll s6, t4, s7
    li a7, 10
    ecall
