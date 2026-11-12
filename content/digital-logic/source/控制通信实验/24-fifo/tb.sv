`timescale 1ns/1ps
module tb;
  logic clk=0,rst,wr_en,rd_en,full,empty,push,pop;
  logic [7:0] din,dout,expected_dout=0;
  logic [2:0] level;
  integer model[$];
  integer cycles=0,writes=0,reads=0,rejected_writes=0,rejected_reads=0,discarded=0,oldest;
  fifo4_demo dut(.clk(clk),.rst(rst),.wr_en(wr_en),.rd_en(rd_en),.din(din),
    .dout(dout),.full(full),.empty(empty),.push(push),.pop(pop),.level(level));
  always #5 clk=~clk;
  task automatic step(input logic r,w,read_request,input logic [7:0] value);
    bit take_write,take_read;
    integer before_level;
    @(negedge clk);rst=r;wr_en=w;rd_en=read_request;din=value;
    before_level=model.size();
    take_write=!r && w && (before_level<4);
    take_read=!r && read_request && (before_level>0);
    #1;
    if (level !== before_level[2:0] || full !== (before_level==4) || empty !== (before_level==0))
      $fatal(1,"FIFO pre-edge flags cycle=%0d",cycles);
    if (push !== take_write || pop !== take_read)
      $fatal(1,"FIFO acceptance cycle=%0d level=%0d request=%b%b actual=%b%b expected=%b%b",
        cycles,before_level,w,read_request,push,pop,take_write,take_read);
    if (take_read) expected_dout=model[0];
    @(posedge clk);#1;
    if (r) begin discarded=discarded+model.size();model.delete();expected_dout=0;end
    else begin
      if (take_read) begin oldest=model.pop_front();reads++;end
      if (take_write) begin model.push_back(value);writes++;end
      if (w && !take_write) rejected_writes++;
      if (read_request && !take_read) rejected_reads++;
    end
    if (dout !== expected_dout || level !== model.size() || full !== (model.size()==4) || empty !== (model.size()==0))
      $fatal(1,"FIFO post-edge cycle=%0d data=%h expected=%h level=%0d expected-level=%0d",cycles,dout,expected_dout,level,model.size());
    cycles++;
    if (cycles<=20) $display("TRACE FIFO cycle=%0d before=%0d push=%b pop=%b after=%0d dout=%h",cycles,before_level,take_write,take_read,model.size(),dout);
  endtask
  initial begin
    rst=1;wr_en=0;rd_en=0;din=0;
    step(1,0,0,0);step(0,0,1,0);
    step(0,1,1,8'ha1);step(0,1,0,8'hb2);
    step(0,1,0,8'hc3);step(0,1,0,8'hd4);
    step(0,1,0,8'he5);step(0,1,1,8'he5);
    step(0,1,1,8'he5);step(0,0,1,0);
    step(0,1,0,8'hf6);step(0,0,1,0);
    step(0,0,1,0);step(0,0,1,0);step(0,0,1,0);
    step(0,1,0,8'h77);step(1,1,1,8'hff);
    step(0,1,0,8'h88);step(0,0,1,0);step(0,0,1,0);
    for (int i=0;i<200;i++) step(0,(i%3!=0),(i%4>=2),8'h40+i[7:0]);
    if (writes != reads+discarded+model.size()) $fatal(1,"FIFO accounting");
    $display("PASS FIFO: %0d cycles writes=%0d reads=%0d rejected-write=%0d rejected-read=%0d reset-discarded=%0d remaining=%0d",cycles,writes,reads,rejected_writes,rejected_reads,discarded,model.size());
    $finish;
  end
  initial begin #3000;$fatal(1,"FIFO timeout");end
endmodule
