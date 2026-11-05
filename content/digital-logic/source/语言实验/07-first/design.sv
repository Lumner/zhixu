module gates_beginner(
  input logic a,
  input logic b,
  output logic y_and,
  output logic y_xor
);
  assign y_and = a & b;
  assign y_xor = a ^ b;
endmodule
