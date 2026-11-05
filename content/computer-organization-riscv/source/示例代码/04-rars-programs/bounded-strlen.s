# RARS RV32, complete standalone program. No input from keyboard.
# Buffer ABC has no NUL. Capacity 3 -> prints length 3 and found-NUL flag 0.
# Caller must supply a readable buffer of at least capacity bytes.
.data
buffer: .byte 65, 66, 67
.text
.globl main
main:
    la t0, buffer
    li t1, 3
    li t2, 0
    li t3, 0
scan:
    bge zero, t1, done
    lbu t4, 0(t0)
    beq t4, zero, found
    addi t2, t2, 1
    addi t0, t0, 1
    addi t1, t1, -1
    j scan
found:
    li t3, 1
done:
    mv a0, t2
    li a7, 1
    ecall
    li a0, 10
    li a7, 11
    ecall
    mv a0, t3
    li a7, 1
    ecall
    li a0, 10
    li a7, 11
    ecall
    li a7, 10
    ecall
