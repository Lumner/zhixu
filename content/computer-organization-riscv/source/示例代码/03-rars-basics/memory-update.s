# RARS RV32, Default memory configuration, little endian.
# Complete standalone program. Expected console: 5 (no newline).
# Final: result=5; t1=0x112233aa; s0=-2; s1=254;
# s2=-2; s3=65534; s4=0x1122bbcc.
.data
.align 2
left: .word 9
right: .word -4
result: .word 0
patch: .word 0x11223344
signed_byte: .byte 0xfe
.align 1
signed_half: .half 0xfffe
.text
.globl main
main:
    la t0, left
    lw t1, 0(t0)
    lw t2, 4(t0)
    add t3, t1, t2
    sw t3, 8(t0)
    la t4, patch
    li t5, 0xaa
    sb t5, 0(t4)
    lw t1, 0(t4)
    la t6, signed_byte
    lb s0, 0(t6)
    lbu s1, 0(t6)
    la t6, signed_half
    lh s2, 0(t6)
    lhu s3, 0(t6)
    li t5, 0xbbcc
    sh t5, 0(t4)
    lw s4, 0(t4)
    lbu a1, 0(t4)
    lbu a2, 1(t4)
    lbu a3, 2(t4)
    lbu a4, 3(t4)
    lw a0, 8(t0)
    li a7, 1
    ecall
    li a7, 10
    ecall
