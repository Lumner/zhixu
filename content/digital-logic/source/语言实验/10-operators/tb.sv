`timescale 1ns/1ps
module tb;
  logic [3:0] a,b,bit_and;
  logic signed [7:0] s;
  logic [7:0] u,logical_right,arithmetic_right,unsigned_right;
  logic logical_and,all_bits,odd,signed_less,mixed_less;
  logic [4:0] wide_sum;
  logic [3:0] mask_input,if_value,ternary_value;
  logic unknown_condition;
  logic [7:0] filled,one;
  operators_demo dut(.a(a),.b(b),.s(s),.u(u),.bit_and(bit_and),
    .logical_and(logical_and),.all_bits(all_bits),.odd(odd),.wide_sum(wide_sum),
    .signed_less(signed_less),.mixed_less(mixed_less),.logical_right(logical_right),
    .arithmetic_right(arithmetic_right),.unsigned_right(unsigned_right));
  initial begin
    a=4'hA; b=4'hC; s=-8'sd1; u=8'h80; #1;
    if ({bit_and,logical_and,all_bits,odd,wide_sum,signed_less,mixed_less,
          logical_right,arithmetic_right,unsigned_right} !==
        {4'h8,1'b1,1'b0,1'b0,5'd22,1'b1,1'b0,8'h7F,8'hFF,8'h40})
      $fatal(1,"operators case A/C");
    a=0; b=4'hF; s=8'sd1; u=8'hFF; #1;
    if ({bit_and,logical_and,all_bits,odd,wide_sum,signed_less,mixed_less,
          logical_right,arithmetic_right,unsigned_right} !==
        {4'h0,1'b0,1'b0,1'b0,5'd15,1'b0,1'b0,8'h00,8'h00,8'h7F})
      $fatal(1,"operators case zero");
    a=4'hF; b=1; s=8'sb1000_0000; u=8'h80; #1;
    if ({bit_and,logical_and,all_bits,odd,wide_sum,signed_less,mixed_less,
          logical_right,arithmetic_right,unsigned_right} !==
        {4'h1,1'b1,1'b1,1'b0,5'd16,1'b1,1'b0,8'h40,8'hC0,8'h40})
      $fatal(1,"operators case minimum signed");
    a=1; b=0; s=0; u=1; #1;
    if ({bit_and,logical_and,all_bits,odd,wide_sum,signed_less,mixed_less,
          logical_right,arithmetic_right,unsigned_right} !==
        {4'h0,1'b0,1'b0,1'b1,5'd1,1'b1,1'b1,8'h00,8'h00,8'h00})
      $fatal(1,"operators case one");
    mask_input=4'b0010;
    if (((mask_input & 4'b0010) != 0)!==1'b1)
      $fatal(1,"parenthesized mask");
    if ((mask_input & 4'b0010 != 0)!==4'b0000)
      $fatal(1,"operator precedence probe");
    filled='1; one=1'b1;
    if (filled!==8'hFF || one!==8'h01) $fatal(1,"fill literal probe");
    unknown_condition=1'bx;
    if (unknown_condition) if_value=4'b1010;
    else if_value=4'b1001;
    ternary_value=unknown_condition?4'b1010:4'b1001;
    if (if_value!==4'b1001 || ternary_value!==4'b10xx)
      $fatal(1,"unknown condition merge");
    if ((1'bx==1'bx)!==1'bx || (1'bx===1'bx)!==1'b1)
      $fatal(1,"equality probe");
    $display("PASS operators: 4 directed cases, bitwise/logical/reduction, width, signedness, shifts");
    $finish;
  end
endmodule
