`timescale 1ns/1ps
module tb;
  logic en;
  logic [1:0] sel;
  logic [3:0] y;
  integer expected;
  decoder dut(.en(en),.sel(sel),.y(y));
  initial begin
    for(int i=0;i<8;i++) begin
      en=i/4; sel=i%4; expected=en?(1<<sel):0; #1;
      if(y!==expected[3:0]) $fatal(1,"decoder i=%0d",i);
    end
    $display("PASS decoder: 8 combinations"); $finish;
  end
endmodule
