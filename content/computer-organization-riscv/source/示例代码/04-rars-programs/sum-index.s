# RARS RV32, complete standalone program. Expected console: 12.
# Index form. Require 0 <= length <= allocated word count.
.data
.align 2
numbers: .word 3, -2, 7, 0, 4
.text
.globl main
main:
    la t0, numbers
    li t1, 0
    li t2, 5
    li t3, 0
loop:
    bge t1, t2, done
    slli t4, t1, 2
    add t4, t0, t4
    lw t5, 0(t4)
    add t3, t3, t5
    addi t1, t1, 1
    j loop
done:
    mv a0, t3
    li a7, 1
    ecall
    li a7, 10
    ecall
