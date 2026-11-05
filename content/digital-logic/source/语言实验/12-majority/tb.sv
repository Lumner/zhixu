`timescale 1ns/1ps
module tb;
  logic a,b,c,y,expected;
  int ones;
  majority dut(.a(a),.b(b),.c(c),.y(y));
  initial begin
    $dumpfile("majority.vcd");
    $dumpvars(0,tb);
    for (int i=0;i<8;i++) begin
      {a,b,c}=i[2:0];
      ones=0;
      if(a) ones=ones+1;
      if(b) ones=ones+1;
      if(c) ones=ones+1;
      expected=(ones>=2);
      #10;
      if(y!==expected)
        $fatal(1,"majority input=%b%b%b actual=%b expected=%b",a,b,c,y,expected);
      $display("t=%0d ns input=%b%b%b ones=%0d y=%b",$time,a,b,c,ones,y);
    end
    $display("PASS majority: 8 input combinations");
    $finish;
  end
  initial begin
    #1000;
    $fatal(1,"timeout");
  end
endmodule
