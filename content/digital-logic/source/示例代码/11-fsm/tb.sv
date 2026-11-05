`timescale 1ns/1ps
module tb;
  logic clk=0,rst=1,advance=0,red,green;
  logic model=0;
  always #5 clk=~clk;
  traffic dut(.clk(clk),.rst(rst),.advance(advance),.red(red),.green(green));
  initial begin
    @(posedge clk); #1;
    for(int i=0;i<24;i++) begin
      @(negedge clk); rst=(i==13); advance=(i%3!=0);
      @(posedge clk);
      if(rst) model=0; else if(advance) model=!model;
      #1;
      if(red!==!model || green!==model) $fatal(1,"FSM i=%0d",i);
    end
    $display("PASS FSM: hold, transitions, reset, exclusive outputs"); $finish;
  end
  initial begin #1000; $fatal(1,"FSM timeout"); end
endmodule
