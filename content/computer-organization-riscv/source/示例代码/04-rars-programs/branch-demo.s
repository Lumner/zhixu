# RARS RV32, complete standalone program. Input t0=-3 -> output 0.
# Clamp a signed integer to at least zero. Change the first li for experiments.
.text
.globl main
main:
    li t0, -3
    blt t0, zero, negative
    mv a0, t0
    j show
negative:
    li a0, 0
show:
    li a7, 1
    ecall
    li a7, 10
    ecall
