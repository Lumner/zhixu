`timescale 1ns/1ps
module tb;
  logic clk=0,we=0;
  logic [3:0] addr=0;
  logic [7:0] din=0,dout;
  integer expected;
  always #5 clk=~clk;
  memory dut(.clk(clk),.we(we),.addr(addr),.din(din),.dout(dout));
  initial begin
    for(int i=0;i<16;i++) begin
      @(negedge clk); we=1; addr=i; din=i+8'h40;
      @(posedge clk); #1;
    end
    for(int i=0;i<16;i++) begin
      @(negedge clk); we=0; addr=i; expected=i+8'h40;
      @(posedge clk); #1;
      if(dout!==expected[7:0]) $fatal(1,"RAM address=%0d",i);
    end
    @(negedge clk); addr=3; we=1; din=8'hA5;
    @(posedge clk); #1;
    if(dout!==8'h43) $fatal(1,"RAM not read-first");
    @(negedge clk); we=0;
    @(posedge clk); #1;
    if(dout!==8'hA5) $fatal(1,"RAM new write absent");
    $display("PASS memory: 16 addresses, synchronous read, read-first collision"); $finish;
  end
  initial begin #2000; $fatal(1,"RAM timeout"); end
endmodule
