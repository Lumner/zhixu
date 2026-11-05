# RARS RV32, complete array sum. Expected console: 12
.data
.align 2
numbers: .word 3, -2, 7, 0, 4
.text
.globl main
main:
    la t0, numbers
    li t1, 5
    li t2, 0
loop:
    beq t1, zero, done
    lw t3, 0(t0)
    add t2, t2, t3
    addi t0, t0, 4
    addi t1, t1, -1
    j loop
done:
    mv a0, t2
    li a7, 1
    ecall
    li a7, 10
    ecall
