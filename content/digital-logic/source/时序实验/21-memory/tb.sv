`timescale 1ns/1ps
module tb;
  logic clk=0,we;
  logic [1:0] addr;
  logic [7:0] din,dout,rom_value,model[0:3];
  bit known[0:3];
  integer checked_edges=0;
  ram4 dut(.clk(clk),.we(we),.addr(addr),.din(din),.dout(dout));
  rom4 lookup(.addr(addr),.value(rom_value));
  always #5 clk=~clk;
  task automatic access(input logic write_value,
      input logic [1:0] address,input logic [7:0] data_value);
    logic [7:0] expected_old,expected_rom;
    @(negedge clk); we=write_value;addr=address;din=data_value;
    expected_old=known[address] ? model[address] : 8'hxx;
    expected_rom=8'ha0+17*address;
    #1;
    if (rom_value !== expected_rom) $fatal(1,"ROM addr=%0d actual=%h expected=%h",address,rom_value,expected_rom);
    @(posedge clk); #1;
    if (dout !== expected_old)
      $fatal(1,"RAM we=%b addr=%0d actual=%h expected-old=%h",we,addr,dout,expected_old);
    if (write_value) begin model[address]=data_value;known[address]=1; end
    checked_edges++;
    $display("TRACE memory we=%b addr=%0d din=%h dout=%h",we,addr,din,dout);
  endtask
  initial begin
    we=0;addr=0;din=0;
    access(0,2'd0,8'h00);
    for (int ad=0; ad<4; ad++) access(1,ad[1:0],8'h20+ad[7:0]);
    for (int ad=0; ad<4; ad++) access(0,ad[1:0],8'h00);
    access(1,2'd2,8'hc3);
    access(0,2'd2,8'h00);
    access(0,2'd1,8'hff);
    access(0,2'd1,8'h00);
    #2;addr=2'd3; #1;
    if (dout !== 8'h21 || rom_value !== 8'hd3)
      $fatal(1,"between edges RAM must hold 21 while ROM follows addr3=D3");
    access(0,2'd3,8'h00);
    $display("PASS memory: %0d synchronous accesses, ROM file, unknown data, read-first and hold",checked_edges);
    $finish;
  end
  initial begin #300; $fatal(1,"memory timeout"); end
endmodule
