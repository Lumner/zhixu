`timescale 1ns/1ps
module tb;
  logic a, b;
  logic y_and, y_xor;
  gates_beginner dut(.a(a), .b(b), .y_and(y_and), .y_xor(y_xor));
  initial begin
    a = 0; b = 0; #1;
    if (y_and !== 1'b0) $fatal(1, "AND failed at 00");
    if (y_xor !== 1'b0) $fatal(1, "XOR failed at 00");
    $display("a=%b b=%b and=%b xor=%b", a, b, y_and, y_xor);
    a = 0; b = 1; #1;
    if (y_and !== 1'b0) $fatal(1, "AND failed at 01");
    if (y_xor !== 1'b1) $fatal(1, "XOR failed at 01");
    $display("a=%b b=%b and=%b xor=%b", a, b, y_and, y_xor);
    a = 1; b = 0; #1;
    if (y_and !== 1'b0) $fatal(1, "AND failed at 10");
    if (y_xor !== 1'b1) $fatal(1, "XOR failed at 10");
    $display("a=%b b=%b and=%b xor=%b", a, b, y_and, y_xor);
    a = 1; b = 1; #1;
    if (y_and !== 1'b1) $fatal(1, "AND failed at 11");
    if (y_xor !== 1'b0) $fatal(1, "XOR failed at 11");
    $display("a=%b b=%b and=%b xor=%b", a, b, y_and, y_xor);
    $display("PASS first: 4 input combinations");
    $finish;
  end
endmodule
