`timescale 1ns/1ps
module tb;
  logic clk=0, rst, clear, en;
  logic [3:0] d, sync_q, async_q;
  integer edge_checks=0;
  reset_compare dut(.clk(clk), .rst(rst), .clear(clear), .en(en),
    .d(d), .sync_q(sync_q), .async_q(async_q));
  always #5 clk=~clk;
  task automatic step(input logic r,c,e,
      input logic [3:0] value,want);
    @(negedge clk); rst=r; clear=c; en=e; d=value;
    @(posedge clk); #1;
    if (sync_q !== want || async_q !== want)
      $fatal(1,"priority rst/clear/en=%b%b%b actual=%h/%h expected=%h",
        rst,clear,en,sync_q,async_q,want);
    edge_checks++;
  endtask
  initial begin
    rst=1; clear=0; en=0; d=0;
    step(0,0,1,4'ha,4'ha);
    en=0;
    #1; rst=1;
    #1;
    if (sync_q !== 4'ha || async_q !== 4'h0)
      $fatal(1,"short reset must leave sync=A and clear async=0");
    #1; rst=0;
    #1;
    if (sync_q !== 4'ha || async_q !== 4'h0)
      $fatal(1,"reset release must not load data by itself");
    @(posedge clk); #1;
    if (sync_q !== 4'ha || async_q !== 4'h0)
      $fatal(1,"disabled outputs must keep different histories");
    for (int code=0; code<8; code++) begin
      step(0,0,1,4'ha,4'ha);
      step(code[2],code[1],code[0],4'h5,
        (code[2] || code[1]) ? 4'h0 : code[0] ? 4'h5 : 4'ha);
    end
    $display("PASS reset: %0d scripted edge checks and 3 pulse/release/hold checks",edge_checks);
    $finish;
  end
  initial begin #500; $fatal(1,"reset timeout"); end
endmodule
