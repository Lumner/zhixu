`timescale 1ns/1ps
module tb;
  logic clk=0;
  logic rst;
  logic [3:0] d, q1, q2;
  integer checked_edges=0;
  pipeline2 dut(.clk(clk), .rst(rst), .d(d), .q1(q1), .q2(q2));
  always #5 clk=~clk;

  task automatic step(input logic reset_value,
      input logic [3:0] data_value, want1, want2);
    @(negedge clk);
    rst=reset_value; d=data_value;
    @(posedge clk); #1;
    if ({q1,q2} !== {want1,want2})
      $fatal(1,"pipeline d=%h rst=%b actual=%h/%h expected=%h/%h",
        d,rst,q1,q2,want1,want2);
    checked_edges++;
    $display("TRACE pipeline t=%0d ns d=%h rst=%b q1=%h q2=%h",$time,d,rst,q1,q2);
  endtask

  initial begin
    $dumpfile("pipeline.vcd"); $dumpvars(0,tb);
    rst=1; d=0;
    step(1,4'h0,4'h0,4'h0);
    step(0,4'ha,4'ha,4'h0);
    step(0,4'hb,4'hb,4'ha);
    #2; d=4'hd; #1;
    if ({q1,q2} !== {4'hb,4'ha}) $fatal(1,"state changed between rising edges");
    step(0,4'hc,4'hc,4'hb);
    step(1,4'hf,4'h0,4'h0);
    step(0,4'hf,4'hf,4'h0);
    step(0,4'h2,4'h2,4'hf);
    $display("PASS pipeline: %0d edge cases and 1 between-edge hold",checked_edges);
    $finish;
  end
  initial begin #200; $fatal(1,"pipeline timeout"); end
endmodule
