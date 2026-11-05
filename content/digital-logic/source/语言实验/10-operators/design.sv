module operators_demo(
  input logic [3:0] a,b,
  input logic signed [7:0] s,
  input logic [7:0] u,
  output logic [3:0] bit_and,
  output logic logical_and, all_bits, odd,
  output logic [4:0] wide_sum,
  output logic signed_less, mixed_less,
  output logic [7:0] logical_right, arithmetic_right, unsigned_right
);
  assign bit_and = a & b;
  assign logical_and = a && b;
  assign all_bits = &a;
  assign odd = ^a;
  assign wide_sum = {1'b0,a} + {1'b0,b};
  assign signed_less = s < 8'sd1;
  assign mixed_less = s < 8'd1;
  assign logical_right = s >> 1;
  assign arithmetic_right = s >>> 1;
  assign unsigned_right = u >>> 1;
endmodule
