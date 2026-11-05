`timescale 1ns/1ps
module tb;
  logic [7:0] data,swapped;
  logic odd;
  integer ones,expected;
  bits_demo dut(.data(data),.swapped(swapped),.odd(odd));
  initial begin
    for(int i=0;i<256;i++) begin
      data=i; ones=0;
      for(int j=0;j<8;j++) ones=ones+((i>>j)&1);
      expected=(i%16)*16+i/16; #1;
      if(swapped!==expected[7:0] || odd!==(ones%2==1)) $fatal(1,"bits i=%0d",i);
    end
    $display("PASS bits: 256 values"); $finish;
  end
endmodule
