# Ripes RV32I, 5-stage model WITH forwarding/hazard detection.
# Set a breakpoint at stop; expected t1=7, t2=14, t3=7.
# la is a pseudo-instruction; inspect its expansion before counting cycles.
.data
.align 2
value: .word 7
.text
.globl main
main:
    la t0, value
    lw t1, 0(t0)
    add t2, t1, t1
    sub t3, t2, t1
stop:
    nop
