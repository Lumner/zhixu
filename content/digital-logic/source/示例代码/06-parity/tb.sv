`timescale 1ns/1ps
module tb;
  logic [7:0] data;
  logic odd8,odd1;
  integer ones;
  parity #(.WIDTH(8)) p8(.data(data),.odd(odd8));
  parity #(.WIDTH(1)) p1(.data(data[0]),.odd(odd1));
  initial begin
    for(int i=0;i<256;i++) begin
      data=i; ones=0;
      for(int j=0;j<8;j++) ones=ones+((i>>j)&1);
      #1;
      if(odd8!==(ones%2==1) || odd1!==data[0]) $fatal(1,"parity i=%0d",i);
    end
    $display("PASS parity: WIDTH 1 and 8, 256 inputs"); $finish;
  end
endmodule
