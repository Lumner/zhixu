`timescale 1ns/1ps
module tb;
  logic clk=0,rst,en,t1,t4,t5;
  logic c1;
  logic [1:0] c4;
  logic [2:0] c5;
  logic [3:0] h1,h4,h5;
  integer r1=0,r4=0,r5=0,e1=0,e4=0,e5=0,old4;
  logic want1,want4,want5;
  tick_counter #(.DIV(1)) u1(.clk(clk),.rst(rst),.en(en),.count(c1),.tick(t1),.events(h1));
  tick_counter #(.DIV(4)) u4(.clk(clk),.rst(rst),.en(en),.count(c4),.tick(t4),.events(h4));
  tick_counter #(.DIV(5)) u5(.clk(clk),.rst(rst),.en(en),.count(c5),.tick(t5),.events(h5));
  always #5 clk=~clk;
  initial begin
    rst=1; en=0;
    for (int i=0; i<25; i++) begin
      @(negedge clk);
      rst=(i==0 || i==14);
      en=!(i==3 || i==4 || i==6 || i==7);
      want1=!rst && en && (r1+1==1);
      want4=!rst && en && (r4+1==4);
      want5=!rst && en && (r5+1==5);
      #1;
      if ({t1,t4,t5} !== {want1,want4,want5})
        $fatal(1,"pre-edge tick i=%0d actual=%b%b%b expected=%b%b%b",i,t1,t4,t5,want1,want4,want5);
      old4=r4;
      if (rst) begin r1=0;r4=0;r5=0;e1=0;e4=0;e5=0; end
      else if (en) begin
        r1=(r1+1)%1; r4=(r4+1)%4; r5=(r5+1)%5;
        if (want1) e1=(e1+1)%16;
        if (want4) e4=(e4+1)%16;
        if (want5) e5=(e5+1)%16;
      end
      @(posedge clk); #1;
      if (c1 !== r1[0] || c4 !== r4[1:0] || c5 !== r5[2:0] ||
          h1 !== e1[3:0] || h4 !== e4[3:0] || h5 !== e5[3:0])
        $fatal(1,"post-edge counter i=%0d actual=%0d/%0d/%0d events=%0d/%0d/%0d",i,c1,c4,c5,h1,h4,h5);
      $display("TRACE tick i=%0d rst=%b en=%b pre4=%0d use4=%b post4=%0d events4=%0d",i,rst,en,old4,want4,c4,h4);
    end
    $display("PASS tick: 25 cycles, DIV=1/4/5, pause at middle/terminal and reset");
    $finish;
  end
  initial begin #400; $fatal(1,"tick timeout"); end
endmodule
