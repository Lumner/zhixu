# RARS RV32. Observe memory and registers; no console output.
# Expected: t1=0x12345678, copy=0x12345678,
# t3=0x78, t5=0xfffffffe, t6=254.
.data
.align 2
value: .word 0x12345678
copy: .word 0
signed_byte: .byte 0xfe
.text
.globl main
main:
    la t0, value
    lw t1, 0(t0)
    la t2, copy
    sw t1, 0(t2)
    lbu t3, 0(t0)
    la t4, signed_byte
    lb t5, 0(t4)
    lbu t6, 0(t4)
    li a7, 10
    ecall
