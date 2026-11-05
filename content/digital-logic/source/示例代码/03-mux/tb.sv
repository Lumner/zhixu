`timescale 1ns/1ps
module tb;
  logic [3:0] a,b,y;
  logic sel;
  mux2 dut(.a(a),.b(b),.sel(sel),.y(y));
  initial begin
    for(int ai=0;ai<16;ai++)
      for(int bi=0;bi<16;bi++)
        for(int si=0;si<2;si++) begin
          a=ai; b=bi; sel=si; #1;
          if(y!==(sel?b:a)) $fatal(1,"mux a=%h b=%h sel=%b",a,b,sel);
        end
    $display("PASS mux: 512 combinations"); $finish;
  end
endmodule
