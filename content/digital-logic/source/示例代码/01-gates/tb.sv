`timescale 1ns/1ps
module tb;
  logic a,b,y_and,y_xor;
  gates dut(.a(a),.b(b),.y_and(y_and),.y_xor(y_xor));
  initial begin
    for(int i=0;i<4;i++) begin
      {a,b}=i[1:0]; #1;
      if(y_and!==(a&b) || y_xor!==(a^b)) $fatal(1,"gates i=%0d",i);
    end
    $display("PASS gates: 4 input combinations"); $finish;
  end
endmodule
