# RARS RV32, complete program.
# Input [3,-2,7,0,4]: prints 12, 7, 3 on separate lines.
# For length 0: prints 0, empty, 0. Does not load the array.
.data
.align 2
numbers: .word 3, -2, 7, 0, 4
newline: .asciz "\n"
empty_text: .asciz "empty"
.text
.globl main
main:
    andi sp, sp, -16
    la a0, numbers
    li a1, 5
    jal ra, stats
    mv s0, a0
    mv s1, a1
    mv s2, a2
    mv s3, a3
    mv a0, s0
    li a7, 1
    ecall
    la a0, newline
    li a7, 4
    ecall
    beq s3, zero, print_empty
    mv a0, s1
    li a7, 1
    ecall
    j after_max
print_empty:
    la a0, empty_text
    li a7, 4
    ecall
after_max:
    la a0, newline
    li a7, 4
    ecall
    mv a0, s2
    li a7, 1
    ecall
    la a0, newline
    li a7, 4
    ecall
    li a7, 10
    ecall

# a0=base, a1=length; <=0 treated as empty.
# Return custom tuple: a0=sum, a1=max or 0, a2=positive, a3=nonempty.
# Clobbers t0-t3,a4,a5; leaf function, preserves all s registers and sp.
stats:
    bge zero, a1, empty
    mv a4, a0
    mv a5, a1
    li t0, 0
    lw t1, 0(a4)
    li t2, 0
scan:
    lw t3, 0(a4)
    add t0, t0, t3
    bge t1, t3, keep_max
    mv t1, t3
keep_max:
    bge zero, t3, not_positive
    addi t2, t2, 1
not_positive:
    addi a4, a4, 4
    addi a5, a5, -1
    bne a5, zero, scan
    mv a0, t0
    mv a1, t1
    mv a2, t2
    li a3, 1
    ret
empty:
    li a0, 0
    li a1, 0
    li a2, 0
    li a3, 0
    ret
