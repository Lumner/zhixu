`timescale 1ns/1ps
module tb;
  logic [3:0] a, b, y;
  logic [1:0] op;
  logic carry, overflow, zero;
  alu4 dut(.a(a), .b(b), .op(op), .y(y),
    .carry(carry), .overflow(overflow), .zero(zero));
  initial begin
    a=4'h7; b=4'h1; op=2'b00; #1;
    if ({y,carry,overflow,zero} !== {4'h8,1'b0,1'b1,1'b0})
      $fatal(1, "7+1 expected y=8 C=0 V=1 Z=0");
    a=4'hf; b=4'h1; op=2'b00; #1;
    if ({y,carry,overflow,zero} !== {4'h0,1'b1,1'b0,1'b1})
      $fatal(1, "F+1 expected y=0 C=1 V=0 Z=1");
    a=4'h8; b=4'h8; op=2'b00; #1;
    if ({y,carry,overflow,zero} !== {4'h0,1'b1,1'b1,1'b1})
      $fatal(1, "8+8 expected y=0 C=1 V=1 Z=1");
    a=4'h3; b=4'h5; op=2'b01; #1;
    if ({y,carry,overflow,zero} !== {4'he,1'b0,1'b0,1'b0})
      $fatal(1, "3-5 expected y=E C=0 V=0 Z=0");
    a=4'h5; b=4'h3; op=2'b01; #1;
    if ({y,carry,overflow,zero} !== {4'h2,1'b1,1'b0,1'b0})
      $fatal(1, "5-3 expected y=2 C=1 V=0 Z=0");
    a=4'h8; b=4'h1; op=2'b01; #1;
    if ({y,carry,overflow,zero} !== {4'h7,1'b1,1'b1,1'b0})
      $fatal(1, "8-1 expected y=7 C=1 V=1 Z=0");
    a=4'h5; b=4'h5; op=2'b01; #1;
    if ({y,carry,overflow,zero} !== {4'h0,1'b1,1'b0,1'b1})
      $fatal(1, "5-5 expected y=0 C=1 V=0 Z=1");
    a=4'ha; b=4'hc; op=2'b10; #1;
    if ({y,carry,overflow,zero} !== {4'h8,1'b0,1'b0,1'b0})
      $fatal(1, "A AND C expected y=8 C=0 V=0 Z=0");
    a=4'ha; b=4'ha; op=2'b11; #1;
    if ({y,carry,overflow,zero} !== {4'h0,1'b0,1'b0,1'b1})
      $fatal(1, "A XOR A expected y=0 C=0 V=0 Z=1");
    $display("PASS alu4: 9 directed arithmetic/flag cases");
    $finish;
  end
endmodule
