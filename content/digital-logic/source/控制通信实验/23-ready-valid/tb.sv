`timescale 1ns/1ps
module tb;
  logic clk=0,rst,in_valid,in_ready,out_valid,out_ready;
  logic [7:0] in_data,out_data,held_source,held_output;
  bit source_stalled=0,output_stalled=0;
  integer model[$];
  integer cycles=0,accepted=0,delivered=0,discarded=0;
  stream1 dut(.clk(clk),.rst(rst),.in_valid(in_valid),.in_data(in_data),
    .in_ready(in_ready),.out_valid(out_valid),.out_data(out_data),.out_ready(out_ready));
  always #5 clk=~clk;
  task automatic step(input logic r,v,input logic [7:0] value,input logic ready_value);
    bit want_ready,want_valid,take_in,take_out;
    integer oldest;
    logic [7:0] expected_front;
    @(negedge clk);rst=r;in_valid=v;in_data=value;out_ready=ready_value;
    want_valid=!r && (model.size()!=0);
    want_ready=!r && (model.size()==0 || ready_value);
    expected_front=0;
    if (model.size()!=0) expected_front=model[0];
    #1;
    if (source_stalled && !r && (!v || in_data !== held_source))
      $fatal(1,"test source broke its hold contract");
    if (output_stalled && !r && (!out_valid || out_data !== held_output))
      $fatal(1,"output changed while stalled");
    if (in_ready !== want_ready || out_valid !== want_valid)
      $fatal(1,"stream cycle=%0d ready/valid=%b/%b expected=%b/%b",cycles,in_ready,out_valid,want_ready,want_valid);
    if (want_valid && out_data !== expected_front) $fatal(1,"stream oldest data mismatch");
    take_in=v && want_ready;take_out=want_valid && ready_value;
    source_stalled=!r && v && !want_ready;held_source=value;
    output_stalled=want_valid && !ready_value;held_output=out_data;
    @(posedge clk);#1;
    if (r) begin discarded=discarded+model.size();model.delete();end
    else begin
      if (take_out) begin oldest=model.pop_front();delivered++;end
      if (take_in) begin model.push_back(value);accepted++;end
    end
    if (out_valid !== (!r && model.size()!=0)) $fatal(1,"stream post-edge occupancy");
    if (model.size()!=0) expected_front=model[0];
    if (!r && model.size()!=0 && out_data !== expected_front) $fatal(1,"stream post-edge data");
    cycles++;
    $display("TRACE stream cycle=%0d input-fire=%b output-fire=%b queued=%0d",cycles,take_in,take_out,model.size());
  endtask
  initial begin
    rst=1;in_valid=0;in_data=0;out_ready=0;
    step(1,0,8'h00,0);
    step(0,1,8'ha1,0);
    step(0,1,8'hb2,0);
    step(0,1,8'hb2,0);
    step(0,1,8'hb2,1);
    step(0,1,8'hc3,1);
    step(0,0,8'h00,1);
    step(0,0,8'h00,1);
    step(0,1,8'hd4,0);
    step(0,0,8'h00,0);
    step(1,0,8'h00,1);
    step(0,1,8'he5,1);
    step(0,0,8'h00,1);
    if (accepted!=5 || delivered!=4 || discarded!=1 || model.size()!=0) $fatal(1,"stream accounting");
    $display("PASS ready/valid: %0d cycles accepted=%0d delivered=%0d reset-discarded=%0d",cycles,accepted,delivered,discarded);
    $finish;
  end
  initial begin #300;$fatal(1,"stream timeout");end
endmodule
