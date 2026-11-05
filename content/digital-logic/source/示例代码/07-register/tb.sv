`timescale 1ns/1ps
module tb;
  logic clk=0,rst=0,en=0;
  logic [7:0] d=0,q;
  always #5 clk=~clk;
  data_reg dut(.clk(clk),.rst(rst),.en(en),.d(d),.q(q));
  task automatic step(input logic r,e,input logic [7:0] value,expected);
    @(negedge clk); rst=r; en=e; d=value;
    @(posedge clk); #1;
    if(q!==expected) $fatal(1,"register actual=%h expected=%h",q,expected);
  endtask
  initial begin
    step(1,1,8'hAA,8'h00);
    step(0,1,8'hA5,8'hA5);
    step(0,0,8'h3C,8'hA5);
    // 一个不覆盖上升沿的同步复位脉冲不改变q。
    @(negedge clk); rst=1; #2; rst=0; #1;
    if(q!==8'hA5) $fatal(1,"sync reset changed q without clock edge");
    @(posedge clk); #1;
    if(q!==8'hA5) $fatal(1,"sync reset pulse unexpectedly sampled");
    step(1,0,8'hFF,8'h00);
    step(0,1,8'h3C,8'h3C);
    $display("PASS register: reset, enable, hold, priority, between-edge pulse"); $finish;
  end
  initial begin #1000; $fatal(1,"register timeout"); end
endmodule
