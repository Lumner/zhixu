`timescale 1ns/1ps
module tb;
  logic clk=0,rst=1,en=0,t4,t1;
  integer model4=0,model1=0;
  always #5 clk=~clk;
  tick_gen #(.DIV(4)) d4(.clk(clk),.rst(rst),.en(en),.tick(t4));
  tick_gen #(.DIV(1)) d1(.clk(clk),.rst(rst),.en(en),.tick(t1));
  initial begin
    @(posedge clk); #1;
    for(int i=0;i<40;i++) begin
      @(negedge clk); rst=(i==21); en=(i%7!=3 && i%7!=4); #1;
      if(t4!==(en && !rst && model4==3) || t1!==(en && !rst && model1==0))
        $fatal(1,"tick before edge i=%0d model=%0d",i,model4);
      @(posedge clk);
      if(rst) begin model4=0; model1=0; end
      else if(en) begin model4=(model4+1)%4; model1=0; end
      #1;
    end
    $display("PASS tick: DIV 1 and 4, pause and reset, 40 cycles"); $finish;
  end
  initial begin #1000; $fatal(1,"tick timeout"); end
endmodule
