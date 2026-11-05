`timescale 1ns/1ps
module tb;
  logic clk=0,rst=1,async_in=0,stable,pressed;
  integer presses=0;
  logic prev_pressed=0;
  always #5 clk=~clk;
  button_filter #(.STABLE_CYCLES(3)) dut(.clk(clk),.rst(rst),.async_in(async_in),
                                        .stable(stable),.pressed(pressed));
  always @(posedge clk) begin
    #1;
    if(!rst) begin
      if(pressed===1'b1) presses++;
      if(pressed===1'b1 && prev_pressed) $fatal(1,"button pulse wider than one cycle");
      prev_pressed=pressed;
    end else prev_pressed=0;
  end
  task automatic cycles(input integer n);
    repeat(n) begin @(posedge clk); #2; end
  endtask
  initial begin
    cycles(2); @(negedge clk); rst=0;
    cycles(2);
    // 只高一个采样周期，经过同步后也不足连续3次。
    @(negedge clk); async_in=1;
    @(negedge clk); async_in=0;
    cycles(10);
    if(stable!==0 || presses!=0) $fatal(1,"button accepted glitch");
    @(negedge clk); async_in=1;
    cycles(10);
    if(stable!==1 || presses!=1) $fatal(1,"button press absent");
    cycles(10);
    if(presses!=1) $fatal(1,"button repeated on hold");
    @(negedge clk); async_in=0;
    cycles(10);
    if(stable!==0 || presses!=1) $fatal(1,"button release");
    @(negedge clk); async_in=1;
    cycles(10);
    if(stable!==1 || presses!=2) $fatal(1,"button second press");
    $display("PASS button: glitch rejection, press, hold, release, second press"); $finish;
  end
  initial begin #2000; $fatal(1,"button timeout"); end
endmodule
