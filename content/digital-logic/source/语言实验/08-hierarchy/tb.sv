`timescale 1ns/1ps
module tb;
  logic a_left, b_left, a_right, b_right;
  logic sum_left, carry_left, sum_right, carry_right;
  two_adders dut(
    .a_left(a_left), .b_left(b_left), .a_right(a_right), .b_right(b_right),
    .sum_left(sum_left), .carry_left(carry_left),
    .sum_right(sum_right), .carry_right(carry_right)
  );
  initial begin
    a_left=0; b_left=0; a_right=0; b_right=0; #1;
    if (sum_left!==0 || carry_left!==0 || sum_right!==0 || carry_right!==0)
      $fatal(1, "hierarchy case 0");
    a_left=1; b_left=1; a_right=0; b_right=1; #1;
    if (sum_left!==0 || carry_left!==1 || sum_right!==1 || carry_right!==0)
      $fatal(1, "hierarchy case 1");
    a_left=0; b_left=1; a_right=1; b_right=1; #1;
    if (sum_left!==1 || carry_left!==0 || sum_right!==0 || carry_right!==1)
      $fatal(1, "hierarchy case 2");
    a_left=1; b_left=1; a_right=1; b_right=1; #1;
    if (sum_left!==0 || carry_left!==1 || sum_right!==0 || carry_right!==1)
      $fatal(1, "hierarchy case 3");
    $display("PASS hierarchy: two independent instances, 4 directed cases");
    $finish;
  end
endmodule
