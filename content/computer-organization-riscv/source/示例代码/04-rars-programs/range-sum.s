# RARS RV32: sum integers 1..N. Change N in the second li.
# Use small N >= 0; N=0,1,5 produces 0,1,15.
.text
.globl main
main:
    li t0, 1
    li t1, 5
    li t2, 0
loop:
    blt t1, t0, done
    add t2, t2, t0
    addi t0, t0, 1
    j loop
done:
    mv a0, t2
    li a7, 1
    ecall
    li a7, 10
    ecall
