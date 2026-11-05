`timescale 1ns/1ps
module tb;
  localparam integer CPB=4;
  logic clk=0,rst=1,start=0,tx,busy;
  logic [7:0] data=0;
  logic [9:0] expected_frame;
  always #5 clk=~clk;
  uart_tx #(.CLKS_PER_BIT(CPB)) dut(.clk(clk),.rst(rst),.start(start),
                                  .data(data),.tx(tx),.busy(busy));
  task automatic send_and_check(input logic [7:0] value);
    @(negedge clk); data=value; start=1;
    @(posedge clk); #1;
    if(tx!==0 || busy!==1) $fatal(1,"UART start");
    start=0; data=~value; expected_frame={1'b1,value,1'b0};
    #(CPB*5-1);
    for(int i=0;i<10;i++) begin
      if(tx!==expected_frame[i] || busy!==1) $fatal(1,"UART value=%h bit=%0d tx=%b",value,i,tx);
      // 忙时注入另一个请求，它不能改变本帧或排队发送。
      if(i==2) start=1;
      if(i==3) start=0;
      if(i<9) #(CPB*10);
    end
    #(CPB*5+1);
    if(busy!==0 || tx!==1) $fatal(1,"UART stop duration");
    repeat(CPB+1) @(posedge clk);
    #1;
    if(busy!==0 || tx!==1) $fatal(1,"UART busy request was queued");
  endtask
  initial begin
    @(posedge clk); #1;
    @(negedge clk); rst=0;
    send_and_check(8'h00); send_and_check(8'hFF); send_and_check(8'hA5);
    // 发送中复位，立即回到空闲；复位仍是同步的。
    @(negedge clk); data=8'h5A; start=1;
    @(posedge clk); #1; start=0;
    @(negedge clk); rst=1;
    @(posedge clk); #1;
    if(tx!==1 || busy!==0) $fatal(1,"UART reset while busy");
    $display("PASS UART: 00 FF A5 frames, center samples, busy rejection, latched data, reset"); $finish;
  end
  initial begin #10000; $fatal(1,"UART timeout"); end
endmodule
