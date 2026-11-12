`timescale 1ns/1ps
module uart_checker #(parameter integer CPB=4)(output logic done);
  logic clk=0,rst,start,tx,busy,want;
  logic [7:0] data;
  integer checked_frames=0,center_samples=0;
  uart_sender #(.CLKS_PER_BIT(CPB)) dut(.clk(clk),.rst(rst),.start(start),.data(data),.tx(tx),.busy(busy));
  always #5 clk=~clk;
  task automatic send_check(input logic [7:0] value);
    logic [7:0] received;
    @(negedge clk);start=1;data=value;
    @(posedge clk);#1;
    if (tx !== 1'b0 || busy !== 1'b1) $fatal(1,"UART start CPB=%0d",CPB);
    start=0;data=~value;received=0;
    #(CPB*5-1);
    for (int symbol=0;symbol<10;symbol++) begin
      if (symbol==0) want=0;
      else if (symbol==9) want=1;
      else want=value[symbol-1];
      if (tx !== want || busy !== 1'b1)
        $fatal(1,"UART CPB=%0d value=%h symbol=%0d actual=%b busy=%b expected=%b",CPB,value,symbol,tx,busy,want);
      if (symbol>=1 && symbol<=8) received[symbol-1]=tx;
      center_samples++;
      if (symbol==2) start=1;
      if (symbol==3) start=0;
      if (symbol<9) #(CPB*10);
    end
    if (received !== value) $fatal(1,"UART reconstructed byte");
    #(CPB*5+1);
    if (busy !== 1'b0 || tx !== 1'b1) $fatal(1,"UART full stop duration");
    repeat (2) @(posedge clk);
    #1;
    if (busy !== 1'b0 || tx !== 1'b1) $fatal(1,"UART busy request was queued");
    checked_frames++;
    if (value==0 || value==8'h53 || value==8'ha5 || value==8'hff)
      $display("TRACE UART CPB=%0d value=%h received=%h",CPB,value,received);
  endtask
  initial begin
    done=0;rst=1;start=0;data=0;
    @(posedge clk);#1;
    @(negedge clk);rst=0;
    for (int value=0;value<256;value++) send_check(value[7:0]);
    @(negedge clk);start=1;data=8'h5a;
    @(posedge clk);#1;start=0;
    @(negedge clk);rst=1;
    @(posedge clk);#1;
    if (tx !== 1'b1 || busy !== 1'b0) $fatal(1,"UART reset during frame");
    $display("PASS UART CPB=%0d: frames=%0d centers=%0d busy rejection, latched data, reset",CPB,checked_frames,center_samples);
    done=1;
  end
endmodule

module tb;
  logic done1,done4;
  uart_checker #(.CPB(1)) c1(.done(done1));
  uart_checker #(.CPB(4)) c4(.done(done4));
  initial begin
    $dumpfile("uart.vcd");$dumpvars(0,tb);
    wait (done1 && done4);
    $display("PASS UART all: 512 frames and 5120 symbol centers at CPB=1/4");
    $finish;
  end
  initial begin #200000;$fatal(1,"UART timeout");end
endmodule
