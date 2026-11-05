`timescale 1ns/1ps
module tb;
  logic clk=0,rst=1,wr_en=0,rd_en=0,full,empty;
  logic [7:0] din=0,dout;
  logic [7:0] queue[0:3],expected_out=0;
  integer n=0,steps=0;
  logic do_push,do_pop;
  always #5 clk=~clk;
  fifo4 dut(.clk(clk),.rst(rst),.wr_en(wr_en),.rd_en(rd_en),.din(din),
            .dout(dout),.full(full),.empty(empty));
  task automatic step(input logic r,w,rd,input logic [7:0] value);
    @(negedge clk); rst=r; wr_en=w; rd_en=rd; din=value;
    do_push=w && n<4; do_pop=rd && n>0;
    @(posedge clk);
    if(r) begin n=0; expected_out=0; end
    else begin
      if(do_pop) begin
        expected_out=queue[0];
        for(int j=0;j<3;j++) queue[j]=queue[j+1];
        n=n-1;
      end
      if(do_push) begin queue[n]=value; n=n+1; end
    end
    #1; steps++;
    if(dout!==expected_out || empty!==(n==0) || full!==(n==4))
      $fatal(1,"FIFO step=%0d n=%0d dout=%h expected=%h full=%b empty=%b",
             steps,n,dout,expected_out,full,empty);
  endtask
  initial begin
    step(1,0,0,0);
    step(0,0,1,0);      // 空读被拒绝
    step(0,1,1,8'hA0); // 空时只写
    step(0,1,0,8'hA1); step(0,1,0,8'hA2); step(0,1,0,8'hA3);
    step(0,1,0,8'hEE); // 满写被拒绝
    step(0,1,1,8'hFF); // 满时只读
    step(0,1,1,8'hB0); // 内部同时读写
    repeat(5) step(0,0,1,0);
    // 确定性操作序列反复穿越空/满/回绕。
    for(int i=0;i<96;i++) step(0,(i%7<5),(i%5<3),i+32);
    step(1,1,1,8'hFF);
    if(n!=0) $fatal(1,"FIFO reset model");
    $display("PASS FIFO: %0d cycles, empty/full rejection, simultaneous requests, wrap, reset",steps);
    $finish;
  end
  initial begin #5000; $fatal(1,"FIFO timeout"); end
endmodule
