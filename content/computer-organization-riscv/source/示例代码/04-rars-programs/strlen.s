# RARS RV32, ASCII byte length. Expected console: 6
.data
message: .asciz "RISC-V"
.text
.globl main
main:
    la t0, message
    li t1, 0
scan:
    lbu t2, 0(t0)
    beq t2, zero, end_scan
    addi t1, t1, 1
    addi t0, t0, 1
    j scan
end_scan:
    mv a0, t1
    li a7, 1
    ecall
    li a7, 10
    ecall
