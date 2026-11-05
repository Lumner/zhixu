`timescale 1ns/1ps
module tb;
  logic [7:0] data, swapped, zero_extended;
  logic signed [3:0] nibble_value;
  logic signed [7:0] sign_extended;
  logic odd;
  logic unknown_flag;
  wire undriven_line;
  bit two_state;
  values_demo dut(.data(data), .nibble_value(nibble_value), .swapped(swapped),
    .zero_extended(zero_extended), .sign_extended(sign_extended), .odd(odd));
  initial begin
    data=8'hA6; nibble_value=-4'sd2; #1;
    if (swapped!==8'h6A || zero_extended!==8'h0E || sign_extended!==-8'sd2 || odd!==0)
      $fatal(1, "values case A6");
    $display("data=%h swapped=%h zero=%h sign=%h odd=%b", data,swapped,zero_extended,sign_extended,odd);
    data=8'h3C; nibble_value=4'sd5; #1;
    if (swapped!==8'hC3 || zero_extended!==8'h05 || sign_extended!==8'sd5 || odd!==0)
      $fatal(1, "values case 3C");
    data=8'h01; nibble_value=4'sb1000; #1;
    if (swapped!==8'h10 || zero_extended!==8'h08 || sign_extended!==-8'sd8 || odd!==1)
      $fatal(1, "values case 01");
    if (unknown_flag!==1'bx || undriven_line!==1'bz || two_state!==1'b0)
      $fatal(1, "default four-state/two-state values");
    if ((1'b0 & unknown_flag)!==1'b0 || (1'b1 & unknown_flag)!==1'bx)
      $fatal(1, "four-state AND");
    $display("states: unknown=%b undriven=%b bit=%b", unknown_flag,undriven_line,two_state);
    $display("PASS values: slices, extensions, parity, X/Z and bit default");
    $finish;
  end
endmodule
