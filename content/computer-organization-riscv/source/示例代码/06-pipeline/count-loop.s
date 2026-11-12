# Complete RARS v1.6 RV32 program. N is nonnegative; default N=5.
# Count main..done EXCLUDING the four printing/exit instructions at done.
.text
.globl main
main:
    addi t0, zero, 0
    addi t1, zero, 5
    addi a0, zero, 0
loop:
    beq t0, t1, done
    add a0, a0, t0
    addi t0, t0, 1
    jal zero, loop
done:
    addi a7, zero, 1
    ecall
    addi a7, zero, 10
    ecall
