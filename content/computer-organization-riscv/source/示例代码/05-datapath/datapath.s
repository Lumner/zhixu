# Ripes RV32I fragment. Break at stop; inspect a0=7.
# No RARS environment calls; do not run past the final instruction.
.text
.globl main
main:
    addi t0, zero, 3
    addi t1, zero, 4
    add a0, t0, t1
stop:
    nop
