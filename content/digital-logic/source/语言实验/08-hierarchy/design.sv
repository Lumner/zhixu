module half_adder(
  input logic a, b,
  output logic sum, carry
);
  assign sum = a ^ b;
  assign carry = a & b;
endmodule

module two_adders(
  input logic a_left, b_left, a_right, b_right,
  output logic sum_left, carry_left, sum_right, carry_right
);
  half_adder u_left(
    .a(a_left), .b(b_left), .sum(sum_left), .carry(carry_left)
  );
  half_adder u_right(
    .a(a_right), .b(b_right), .sum(sum_right), .carry(carry_right)
  );
endmodule
